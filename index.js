document.addEventListener("DOMContentLoaded", function() {


});

/*
VueJs code
*/

const { createApp, ref, onMounted, onBeforeUnmount, computed, defineModel, watch } = Vue;
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
        const currentFolder = ref(null);
        const theme = ref("system");
        const updaterProgress = ref(null);
        let blockDiffList = [];

        // set theme khi khởi động
        window.electronAPI.requestGetStoreByKey('theme').then((data) => {
            console.log(data);
            if (!data) {
                theme.value = 'system';
            } else {
                theme.value = data;
            }
            const html = document.querySelector('html');
            if (theme.value === 'light') {
                html.setAttribute('data-color-mode', 'light');
                html.setAttribute('data-dark-theme', 'light');
            } else if (theme.value === 'dark') {
                html.setAttribute('data-color-mode', 'dark');
                html.setAttribute('data-dark-theme', 'dark');
            } else {
                const isDarkModeOs = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (isDarkModeOs) {
                    html.setAttribute('data-color-mode', 'dark');
                    html.setAttribute('data-dark-theme', 'dark');
                } else {
                    html.setAttribute('data-color-mode', 'light');
                    html.setAttribute('data-dark-theme', 'light');
                }
            }
        })

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

        // lắng nghe mỗi khi người dùng chọn folder local repository
        window.electronAPI.onFolderSelected((folderPath) => {
            selectedLogs.value = new Set();
            selectedFile.value = null;
            changedFiles.value = [];
            loadDataGit();
        });

        // Khi người dùng mở Settings
        window.electronAPI.onSettingsDialogOpen(() => {
            document.getElementById("settingsDialog").showModal();
        })

        // Khi đang download update
        window.electronAPI.onDownloadUpdate((progress) => {
            console.log(progress);
            updaterProgress.value = progress;
        })

        // Khi download xong (hoặc lỗi trong quá trình download)
        window.electronAPI.onCompleteDownloadUpdate(() => {
            updaterProgress.value = null;
        })

        function getGravatarUrl(email) {
            const hash = md5(email);
            return `https://www.gravatar.com/avatar/${hash}`;
        }

        function getFirstLogSelected() {
            return selectedLogs.value.values().next().value;
        }

        const selectFolderFromHtml = () => {
             window.electronAPI.sendDialogSelectFolder();
        }
        const loadDataGit = async () => {
            console.log("==== start load data ====");
            JsLoadingOverlay.show({
                "overlayBackgroundColor": "#666666",
                "overlayOpacity": "0.6",
                "spinnerIcon": "ball-spin-fade",
                "spinnerColor": "#13A0CC",
                "spinnerSize": "3x",
                "overlayIDName": "overlay",
                "spinnerIDName": "spinner",
                "offsetX": 0,
                "offsetY": 0,
                "containerID": null,
                "lockScroll": false,
                "overlayZIndex": 9998,
                "spinnerZIndex": 9999
            });
            // kiểm tra xem store có lưu thông tin local repository gần nhất hay không?
            currentFolder.value = await window.electronAPI.requestGetStoreByKey('currentFolder');
            console.log(currentFolder.value);

            // nếu như trước đó app đã mở một folder rồi
            if (currentFolder.value) {
                // tiến hành kiểm tra xem folder đã mở trước đó có phải là một repo git hợp lệ không?
                // nếu không hợp lệ, hiển thị một folder kết hợp với hiển thị giao diện như khi khi mở app lần đầu
                let gitInfo = await window.electronAPI.requestGitInfo(currentFolder.value);
                if (!gitInfo.validRepo) {
                    // todo: tạm thời sử dụng alert, cần đổi sang dùng popup html
                    alert(`The folder ${currentFolder.value} is not a valid Git repository!`);
                    // xoá folder không hợp lệ khỏi store
                    await window.electronAPI.requestSetStoreByKey('currentFolder', null);
                    // sau khi xoá xong, hiện màn hình dành cho người dùng app lần đầu
                    currentFolder.value = null;
                } else {
                    validRepo.value = gitInfo.validRepo;
                    repoName.value = gitInfo.repoName;
                    currentBranch.value = gitInfo.currentBranch;
                    branches.value = gitInfo.branches;
                    allLogs.value = gitInfo.logs;
                    console.log(gitInfo.logs);
                }
                JsLoadingOverlay.hide();
            } else {
                // hiển thị giao diện dành cho người dùng lần đầu
                currentFolder.value = null;
                JsLoadingOverlay.hide();
            }
            await window.electronAPI.requestUpdateToolbar();
        }
        const openDialog = () => {
            document.getElementById("settingsDialog").showModal();
        }
        const closeDialog = () => {
            document.getElementById("settingsDialog").close();
        }

        const changeTheme = async theme => {
            theme.value = theme;
            await window.electronAPI.requestSetStoreByKey('theme', theme);
        }

        watch(theme, (newValue) => {
            window.electronAPI.requestSetStoreByKey('theme', newValue);
            const html = document.querySelector('html');
            if (newValue === 'light') {
                html.setAttribute('data-color-mode', 'light');
                html.setAttribute('data-dark-theme', 'light');
            } else if (newValue === 'dark') {
                html.setAttribute('data-color-mode', 'dark');
                html.setAttribute('data-dark-theme', 'dark');
            } else {
                const isDarkModeOs = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (isDarkModeOs) {
                    html.setAttribute('data-color-mode', 'dark');
                    html.setAttribute('data-dark-theme', 'dark');
                } else {
                    html.setAttribute('data-color-mode', 'light');
                    html.setAttribute('data-dark-theme', 'light');
                }
            }
            generateHtmlFromDiffText(diffText.value);
        });

        onMounted(() => {
            loadDataGit();
        });

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
            currentFolder,
            theme,
            updaterProgress,

            // function
            selectItem,
            selectedFileItem,
            getFirstLogSelected,
            getGravatarUrl,
            updateSearchQuery,
            selectFolderFromHtml,
            openDialog,
            closeDialog,
            changeTheme,
        }
    },
}).mount('#app');
