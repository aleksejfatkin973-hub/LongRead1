'use strict';

window.scorm = pipwerks.SCORM;
window.lmsConnected = null;
window.hasScormProgress = false;

window.scormLocation = null;
window.scormBlocks = null;

function handleError(msg) {
    alert(msg);
    //window.close();
}

function getProgress() {
    window.scormResumeState = null;
    window.hasScormProgress = false;
    window.scormBlocks = null;
    window.scormLocation = null;
    let token = scorm.get("cmi.suspend_data");
    if (token !== null && token !== undefined && token !== '' && typeof token === 'string') {
        try {
            const decompressed = LZString.decompressFromBase64(token);
            if (decompressed) {
                const parsed = JSON.parse(decompressed);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.progress && parsed.currentLesson) {
                        window.scormBlocks = parsed.progress;
                        window.scormLocation = parsed.currentLesson;
                    } else {
                        window.scormBlocks = parsed;
                        window.scormLocation = parsed.currentLesson;
                    }
                    window.scormResumeState = parsed.resumeState || null;
                    window.hasScormProgress = Boolean(window.scormBlocks);
                }
            }
        } catch (error) {
            console.error('[SCORM] Failed to parse suspend_data', error);
        }
    }
    // if ((location !== null && location !== undefined && location !== '') && (blocks !== null && blocks !== undefined && blocks !== '')) {
    //     window.scormLocation = location === '' ? null : location;
    //     window.scormLocation = blocks === '' ? null : JSON.parse(blocks).currentLesson;
    //     window.scormBlocks = blocks === '' ? null : JSON.parse(blocks);
    //     window.hasScormProgress = true;
    //     // console.log('wtf');
    //     // console.log('lcation ' + location);
    //     // console.log('blocks ' + blocks);
    // }
    handleProgressUserInteraction(window.resumeSettings, window.hasScormProgress);
}

function uploadProgress() {
    if (window.lmsConnected) {
        scorm.set("cmi.location", window.currentLesson.toString()); // lesson
        const payload = {
            currentLesson: window.currentLesson,
            progress: window.blocksCountLessons,
            resumeState: typeof window.__getResumeStateSnapshot === 'function'
                ? window.__getResumeStateSnapshot()
                : null
        };
        let token = LZString.compressToBase64(JSON.stringify(payload));
        scorm.set("cmi.suspend_data", token); // full progress by lessons + resume state
        scorm.set("cmi.completion_status", "incomplete");
        scorm.set("cmi.success_status", "unknown");
        scorm.save();
    }
}
function normalizeTo5PercentSteps(rawProgress) {
    const percent = rawProgress * 100;
    const roundedPercent = Math.round(percent / 5) * 5;
    return (roundedPercent / 100).toString();
}

function disableWaitingData() {
    let overlay = document.querySelector('.scorm-loader-overlay');
    let body = document.querySelector('.body-js');

    overlay.style.display = 'none';
    body.classList.remove('body-no-scroll');
}

function initCourse() {
    window.lmsConnected = scorm.init();
    if (lmsConnected) {
        getProgress();
        const completionStatus = scorm.get("cmi.completion_status");
        const successStatus = scorm.get("cmi.success_status");
        if (completionStatus === "completed" && successStatus === "passed") {
            console.log("Вы уже прошли этот курс.");
        }

    } else {
        console.log("Ошибка: Курс не может связаться с LMS");
    }
}

window.onload = function () {
    disableWaitingData();
    initCourse();
}

window.onbeforeunload = function () {
    if (lmsConnected) {
        scorm.set("cmi.success_status", "unknown");
        scorm.set("cmi.success_status", "unknown");
        scorm.save();
        scorm.quit()
    }
};

function setComplete() {
    updateCompleteScormData();

    if (lmsConnected) {
        let completion = scorm.set("cmi.completion_status", "completed");
        if (completion) {
            scorm.save();
            scorm.quit();
        } else {
            console.log("Ошибка: Курс не может быть отмечен как пройденный!");
        }

    } else {
        console.log("Ошибка: Курс не подключён к LMS");
    }
}

function updateCompleteScormData() {
    if (lmsConnected) {
        scorm.set("cmi.score.scaled", (finalScore / maxScore).toString());
        scorm.set("cmi.score.min", "0");
        scorm.set("cmi.score.max", maxScore.toString());
        scorm.set("cmi.score.raw", finalScore.toString());
        scorm.set("cmi.score.scaled", (finalScore / maxScore).toString());

        // scorm.set("cmi.progress_measure", (window.progress / window.blocksCount).toString()); // progress
        scorm.set("cmi.progress_measure", normalizeTo5PercentSteps(window.progress_measure));
        scorm.set("cmi.location", ""); // lesson
        scorm.set("cmi.suspend_data", ""); // full progress by lessons
        scorm.set("cmi.session_time", window.sessionTime());

        finalScore >= (maxScore * passPercentage / 100) ?
            scorm.set("cmi.success_status", "passed") :
            scorm.set("cmi.success_status", "failed");
        scorm.save();
    } else {
        console.log("Ошибка: Курс не подключён к LMS");
    }
}

function initFinishButton() {
    let completeButton = document.getElementById("complete-button");
    let completeFailureButton = document.getElementById("complete-button-failure");

    if (completeButton) {
        completeButton.addEventListener('click', function onClick(e) {
            e.preventDefault();
            // uploadProgress();
            setComplete();
            completeButton.removeEventListener('click', onClick);
            window.close();
            const course = document.getElementById('course');
            const body = document.querySelector('body');
            const navMenu = document.querySelector('nav.navbar');
            const progressBar = document.querySelector('#progress-bar');
            if (navMenu) {
                navMenu.style.display = 'none';
            }
            if (progressBar) {
                progressBar.style.display = 'none';
            }
            course.style.display = 'none';
            body.insertAdjacentHTML('beforeend', '<div class="container mb-20 text-center" style="margin-top: 400px;">' +
                '<p>Этот материал пройден. Закройте вкладку или переходите к другому материалу.</p>' +
                '</div>');
        });
        if (completeFailureButton) {
            completeFailureButton.addEventListener('click', function onClick(e) {
                e.preventDefault();
                setComplete();
                completeButton.removeEventListener('click', onClick);
                window.close();
                const course = document.getElementById('course');
                const body = document.querySelector('body');
                const navMenu = document.querySelector('nav.navbar');
                const progressBar = document.querySelector('#progress-bar');
                if (navMenu) {
                    navMenu.style.display = 'none';
                }
                if (progressBar) {
                    progressBar.style.display = 'none';
                }
                course.style.display = 'none';
                body.insertAdjacentHTML('beforeend', '<div class="container mb-20 text-center" style="margin-top: 400px;">' +
                    '<p>Этот материал пройден. Закройте вкладку или переходите к другому материалу.</p>' +
                    '</div>');
            });
        }
    }
}


