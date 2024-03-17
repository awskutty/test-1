/**
 * Description : For gc collect of the service
 */
function runGC(callbackrungc) {
    if (global.gc) {
        global.gc();
        callbackrungc('Garbage Collected');
    } else {
        callbackrungc('Garbage Collection Disabled');
    }
}

process.on('message', function (obj) {
    runGC(function (data) {
        process.send(data);
    });
});
/********* End of File *************/