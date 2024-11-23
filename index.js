document.addEventListener("DOMContentLoaded", function() {


});

/*
VueJs code
*/

const { createApp, ref, onMounted, onBeforeUnmount, computed, defineModel} = Vue;
createApp({
    setup() {
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
            console.log("compured ===============")
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

        const generateHtmlFromDiffText = (diffText) => {
            let colorScheme = 'light';
            let styleDiffEl = ``;
            let styleFrame = '';
            const htmlEl = document.getElementsByTagName('html');
            if (htmlEl[0].getAttribute("data-color-mode") === "dark") {
                styleDiffEl = `style="background-color: #0e1117"`;
                colorScheme = 'dark';
                styleFrame = `<link rel="stylesheet" href="css/github-dark.min.css" />
    <link
            rel="stylesheet"
            type="text/css"
            href="css/diff2html-dark.css"
    />
    <!-- nếu dark-mode-on -->
    <style>
        html {
            background-color: #0e1117;
        }
    </style>`;
            } else {
                styleFrame = `<link rel="stylesheet" href="css/github.min.css" />
    <link
            rel="stylesheet"
            type="text/css"
            href="css/diff2html.min.css"
    />`;
            }

            diffHtml.value = Diff2Html.html(diffText, {
                drawFileList: false,
                matching: 'lines',
                outputFormat: 'line-by-line',
                colorScheme: colorScheme,
                renderNothingWhenEmpty: true,
            });

            // sử dụng iframe
            const srcDoc = `<!doctype html>
<html lang="en-us">
<head>
    <meta charset="utf-8" />
    <!-- Make sure to load the highlight.js CSS file before the Diff2Html CSS file -->
    ${styleFrame}
    <style>
        /* Thanh cuộn cho trình duyệt WebKit (Chrome, Safari) */
*::-webkit-scrollbar {
    width: 6px; /* Độ rộng của thanh cuộn */
    height: 6px;
}

*::-webkit-scrollbar-track {
    border-radius: 10px; /* Làm tròn nền của thanh cuộn */
}

*::-webkit-scrollbar-thumb {
    background: #c1c1c1; /* Màu của thanh cuộn */
    border-radius: 10px; /* Làm tròn thanh cuộn */
}

*::-webkit-scrollbar-thumb:hover {
    background: #a0a0a0; /* Màu của thanh cuộn khi hover */
}
    </style>
    <script type="text/javascript" src="common_js/diff2html.min.js"></script>
    <script type="text/javascript" src="common_js/diff2html-ui.min.js"></script>
</head>
<body>
<div id="diff" ${styleDiffEl}>
${diffHtml.value}
</div>
</body>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const targetElement = document.getElementById('diff');
        const diff2htmlUi = new Diff2HtmlUI(targetElement);
        diff2htmlUi.fileListToggle(false);
        diff2htmlUi.fileContentToggle();
        diff2htmlUi.synchronisedScroll();
        diff2htmlUi.highlightCode();
    });
</script>
</html>
`;
            console.log(srcDoc);
            const iframeDocument = iframeRefDiff.value.contentDocument || iframeRefDiff.value.contentWindow.document;
            iframeDocument.open();
            iframeDocument.write(srcDoc);
            iframeDocument.close()
        }

        // Hàm để lấy thông tin Git qua Electron
        function fetchRepoInfo() {
            window.electronAPI.requestGitInfo().then((data) => {
                repoName.value = data.repoName;
                currentBranch.value = data.currentBranch;
                branches.value = data.branches;
                allLogs.value = data.logs;
            });
        }

        function getGravatarUrl(email) {
            const hash = md5(email);
            return `https://www.gravatar.com/avatar/${hash}`;
        }

        function getFirstLogSelected() {
            return selectedLogs.value.values().next().value;
        }

        fetchRepoInfo()

        return {
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
