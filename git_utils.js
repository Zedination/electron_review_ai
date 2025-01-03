const simpleGit = require("simple-git");
const path = require("path");


async function getGitCommits(repoPath) {
    const git = simpleGit(repoPath);
    const log = await git.log();
    return log.all;
}

async function getBranches(repoPath) {
    const git = simpleGit(repoPath);
    const branches = await git.branch();
    return {
        branches: branches.all,
        currentBranch: branches.current
    };
}

async function getAllInfoGit(repoPath) {
    // await sleep(2000);
    const git = simpleGit(repoPath);
    let isValidRepo = false;
    try {
        isValidRepo = await git.checkIsRepo();
    } catch (error) {
        console.error('Error checking repository:', error.message);
    }
    if (!repoPath || !isValidRepo) {
        return {
            validRepo: false
        }
    }
    const branches = await git.branch();
    const localBranches = await git.branchLocal()
    const log = await git.log();
    const repoName = path.basename(repoPath);
    return {
        validRepo: isValidRepo,
        repoName: repoName,
        branches: branches.all,
        localBranches: localBranches.all,
        currentBranch: branches.current,
        logs: log.all
    }
}

async function getDiffText(hashListForDiff, repoPath, diffType) {
    const git = simpleGit(repoPath);
    let diffText = "";
    switch (diffType) {
        case 'diff_commit':
            if (hashListForDiff.length === 1) {
                // show diff text của một commit
                diffText = await git.show([hashListForDiff[0]]);
            } else if (hashListForDiff.length === 2) {
                diffText = await git.show([hashListForDiff[0], hashListForDiff[1]]);
            }
            break;
        case 'diff_branches':
            // todo
        default:
            break;
    }
    return diffText;
}

async function getChangedFilesByDiffHash(hashListForDiff, repoPath, diffType) {
    const git = simpleGit(repoPath);

    switch (diffType) {
        case 'diff_commit':
            try {
                // Sử dụng `git.show` với `--name-status` để lấy danh sách file và trạng thái thay đổi
                let showResult = '';
                if (hashListForDiff.length === 1) {
                    // show diff text của một commit
                    showResult = await git.show([hashListForDiff[0], '--name-status', '--pretty=format:']);
                } else if (hashListForDiff.length === 2) {
                    showResult = await git.show([hashListForDiff[0], hashListForDiff[1], '--name-status', '--pretty=format:']);
                }

                // Tạo mảng các đối tượng chứa thông tin thay đổi của mỗi file
                return showResult.trim().split('\n').map(line => {
                    const [status, ...filePathParts] = line.split('\t');
                    const filePath = filePathParts.join('\t'); // Ghép lại nếu đường dẫn chứa ký tự tab
                    return {
                        path: filePath, // Đường dẫn đầy đủ của file
                        name: filePath.split('/').pop(), // Tên file
                        status: status // Loại thay đổi (A, M, D,...)
                    };
                });
            } catch (error) {
                console.error("Error fetching changed files:", error);
                return [];
            }
        case 'diff_branches':
        // todo
        default:
            break;
    }
    return [];
}

async function getDiffTextByHashAndFile(repoPath, filePath, hashList, diffType) {
    const git = simpleGit(repoPath);
    let diffText = "";
    switch (diffType) {
        case 'diff_commit':
            if (hashList.length === 1) {
                // diffText = await git.show([`${hashList[0]}:${filePath}`]);
                diffText = await git.show([hashList[0], '--', filePath]);
            } else if (hashList.length === 2) {
                diffText = await git.diff([`${commitHash1}..${commitHash2}`, '--', filePath]);
            }
            break;
        case 'diff_branches':
            break;
        default:
            break;
    }
    return diffText;
}

async function checkoutBranch(repoPath, branchName, confirmCallback, errorCallbback) {
    try {
        const git = simpleGit(repoPath);
        const status = await git.status();

        const localBranches = await git.branchLocal();

        let flag = '';
        if (status.files.length > 0) {
            let choice = await confirmCallback(`You have changes on this branch. Do you want to bring your changes to ${branchName}?`);
            if (choice.response === 0) {
                flag = '--merge';
            } else return false;
        }
        if (localBranches.all.includes(branchName)) {
            await git.checkout(branchName, [flag]);
        } else {
            await git.checkoutBranch(branchName.replace('remotes/origin/', ''), branchName, [flag]);
        }
        return true;
    } catch (error) {
        await errorCallbback(error.message);
        return false;
    }
}

/**
 * Fetch mặc định (toàn bộ remote repository)
 * @param repoPath
 * @returns {Promise<void>}
 */
async function fetchOrigin(repoPath) {
    const git = simpleGit(repoPath);
    try {
        let result = await git.fetch();
        console.log(result);
    } catch (error) {
        console.error('Error during fetch:', error.message);
    }
}

async function getAllBranches(repoPath) {
    const git = simpleGit(repoPath);
    const branches = await git.branch();
    const localBranches = await git.branchLocal()
    return {
        branches: branches.all,
        localBranches: localBranches.all,
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



module.exports = { getGitCommits, getBranches, getAllInfoGit, getChangedFilesByDiffHash, getDiffTextByHashAndFile, checkoutBranch, fetchOrigin, getAllBranches};