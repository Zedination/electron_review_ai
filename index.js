document.addEventListener("DOMContentLoaded", function() {


});

/*
VueJs code
*/

const { createApp, ref, onMounted, onBeforeUnmount} = Vue;
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

        const generateHtmlFromDiffText = (diffText) => {
            diffHtml.value = Diff2Html.html(diffText, {
                drawFileList: false,
                matching: 'lines',
                outputFormat: 'side-by-side',
                colorScheme: 'dark',
                renderNothingWhenEmpty: true,
            });

            console.log(diffHtml.value);

            // const shadowRoot = shadowContainerDiff.value.attachShadow({ mode: 'open' });
            // shadowRoot.innerHTML = `
            //   <style>
            //     /* Đưa CSS của diff2html vào trong Shadow DOM */
            //     @import url('css/diff2html.min.css');
            //     @import url('css/github.min.css');
            //     /* Thêm các kiểu tùy chỉnh nếu cần */
            //   </style>
            //   ${diffHtml.value}
            // `;

            // sử dụng iframe
            const srcDoc = `<!doctype html>
<html lang="en-us">
<head>
    <meta charset="utf-8" />
    <!-- Make sure to load the highlight.js CSS file before the Diff2Html CSS file -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/10.7.1/styles/github.min.css" />
    <link
            rel="stylesheet"
            type="text/css"
            href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css"
    />
    <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html.min.js"></script>
</head>
<body>
${diffHtml.value}
</body>
</html>
`;
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

            // function
            selectItem,
            selectedFileItem,
            getFirstLogSelected,
            getGravatarUrl
        }
    },
}).mount('#app');
