document.addEventListener("DOMContentLoaded", function() {


});

/*
VueJs code
*/

const { createApp, ref, onMounted, onBeforeUnmount, computed, defineModel} = Vue;
createApp({
    setup() {
        const validRepo = ref(false);
        const repoName = ref('');
        const currentBranch = ref('');
        const branches = ref([]);
        const allLogs = ref([]);
        const selectedLogs = ref(new Set());
        const selectedFile = ref(null);
        const changedFiles = ref([]);
        const diffText = ref('');
        const diffHtml = ref(null);
        const shadowContainerDiff = ref(null);
        const iframeRefDiff = ref(null);
        const searchCommitQuery = ref('');
        let blockDiffList = [];

        const selectItem = (log, event) => {

            if (event.ctrlKey) {
                selectedLogs.value = selectedLogs.value.add(log);
            } else {
                selectedLogs.value = new Set().add(log);
            }

            // nếu khi người dùng click vào một hoặc một số commit khác mà không phải commit đang chọn trước đó, clear selectedFile
            if (selectedFile && selectedLogs.value.size > 1 || !selectedLogs.value.has(selectedFile.value)) {
                selectedFile.value = null;
            }

            // get list changed files
            window.electronAPI.requestChangedFiles([log.hash], 'diff_commit').then((data) => {
                changedFiles.value = data;
            });
        };

        const selectedFileItem = (file) => {
            selectedFile.value = file;
            // get diff text mỗi khi click vào một file
            // todo: mới chỉ code cho trường hợp một file và một commit, cần bổ sung trường hợp diff 2 commit hoặc diff 2 hash
            let hashList = [getFirstLogSelected().hash];
            window.electronAPI.requestDiffTextByFilePath(file.path, hashList, 'diff_commit').then((data) => {
                diffText.value = data;
                generateHtmlFromDiffText(data);
            });
        }

        const clearSelection = (event) => {
            const commitListEl = document.querySelector('.commit-list-nav');
            if (!commitListEl.contains(event.target)) {
                selectedLogs.value = new Set();
            }
        };

        const updateSearchQuery = event => {
            searchCommitQuery.value = event.target.value;
        }

        const filteredLogs = computed(() => {
            if (searchCommitQuery.value.trim().length === 0) {
                return allLogs.value;
            }
            return allLogs.value.filter((log) => {
                const trimedQuery = searchCommitQuery.value.trim().toLowerCase();
                return log.hash.includes(trimedQuery)
                    || removeVietnameseTones(log.message.toLowerCase()).includes(removeVietnameseTones(trimedQuery))
                    || removeVietnameseTones(log.author_name.toLowerCase()).includes(removeVietnameseTones(trimedQuery))
                    || removeVietnameseTones(log.author_email.toLowerCase()).includes(removeVietnameseTones(trimedQuery))
                    || log.date.toLowerCase().includes(trimedQuery);
            })
        })

        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) {
                console.warn("Message from untrusted origin:", event.origin);
                return;
            }

            // Xử lý dữ liệu nhận được từ iframe
            const receivedData = event.data;
            if (receivedData.requestType === 'request_endpoint_server') {
                // lấy endpoint tại đây
                let endpoint = 'http://localhost:8000/v1';

                // gửi endpoint và các thông tin liên quan trở lại iframe để thực thi xử lý
                let iframeEl = document.getElementById('isolated-frame');
                let prompt = 'Luôn luôn trả lời bằng tiếng Việt. Tìm lỗi sai và đề xuất sửa lỗi dựa trên đoạn diff string mà tôi cung cấp dưới đây:\n';
                const targetBlock = blockDiffList.find(value => value.id === receivedData.id);
                prompt += targetBlock.unifiedDiff + '\n';
                iframeEl.contentWindow.postMessage({
                    endpoint,
                    prompt,
                    id: receivedData.id,
                }, "*");
            }
        });

        const generateHtmlFromDiffText = async (diffText) => {
            let colorScheme = 'light';
            let styleDiffEl = ``;
            let styleFrame = '';
            const htmlEl = document.getElementsByTagName('html');
            if (htmlEl[0].getAttribute("data-color-mode") === "dark") {
                styleDiffEl = `style="background-color: #0e1117"`;
                colorScheme = 'dark';
                styleFrame = await fetchTemplate('style_dark.html', {});
            } else {
                styleFrame = await fetchTemplate('style_light.html', {});
            }

            diffHtml.value = Diff2Html.html(diffText, {
                drawFileList: false,
                matching: 'lines',
                outputFormat: 'line-by-line',
                colorScheme: colorScheme,
                renderNothingWhenEmpty: true,
            });

            // parse diff string into block diff list
            blockDiffList = [];
            Diff2Html.parse(diffText).forEach(file => {
                file.blocks.forEach((block, index) => {
                    let unifiedDiff = block.header;
                    block.lines.forEach((line) => {
                        unifiedDiff = unifiedDiff + line.content;
                    })
                    const lastLineOfBlock = block.lines.at(-1);
                    let line = '';
                    if (!lastLineOfBlock.oldNumber && lastLineOfBlock.newNumber) {
                        line = lastLineOfBlock.newNumber;
                    } else if (!lastLineOfBlock.newNumber && lastLineOfBlock.oldNumber) {
                        line = lastLineOfBlock.oldNumber;
                    } else {
                        line = lastLineOfBlock.oldNumber + "-" + lastLineOfBlock.newNumber;
                    }
                    blockDiffList.push({
                        id: `block_${index+1}`,
                        line,
                        unifiedDiff
                    })
                })
            })

            const blockInfoStr = JSON.stringify(blockDiffList.map(value => ({id: value.id, line: value.line})));

            // sử dụng iframe
            const srcDoc = await fetchTemplate('template_diff.html', {styleDiffEl, styleFrame, blockInfoStr, diffHtmlValue: diffHtml.value});

            //generate html from diff
            const iframeDocument = iframeRefDiff.value.contentDocument || iframeRefDiff.value.contentWindow.document;
            iframeDocument.open();
            iframeDocument.write(srcDoc);
            iframeDocument.close()
        }

        // Hàm để lấy thông tin Git qua Electron
        function fetchRepoInfo() {
            window.electronAPI.requestGitInfo().then((data) => {
                if (!data.validRepo) {
                    alert("The folder you selected is invalid.");
                    return;
                }
                validRepo.value = data.validRepo;
                repoName.value = data.repoName;
                currentBranch.value = data.currentBranch;
                branches.value = data.branches;
                allLogs.value = data.logs;
            });
        }

        // lắng nghe mỗi khi người dùng chọn folder local repository
        window.electronAPI.onFolderSelected((folderPath) => {
            console.log(folderPath);
            fetchRepoInfo();
        });

        function getGravatarUrl(email) {
            const hash = md5(email);
            return `https://www.gravatar.com/avatar/${hash}`;
        }

        function getFirstLogSelected() {
            return selectedLogs.value.values().next().value;
        }

        // load thông tin repo khi mới bắt đầu mở app
        fetchRepoInfo()

        return {
            validRepo,
            repoName,
            currentBranch,
            branches,
            allLogs,
            selectedLogs,
            changedFiles,
            selectedFile,
            diffHtml,
            shadowContainerDiff,
            iframeRefDiff,
            filteredLogs,

            // function
            selectItem,
            selectedFileItem,
            getFirstLogSelected,
            getGravatarUrl,
            updateSearchQuery
        }
    },
}).mount('#app');
