/*
    @Api_Name           : /DownloadFile,
    @Descriptions        : To get file data form fx db
    @Last Error Code    : 'ERR-RES-70209'
*/

// Require dependencies
var reqExpress = require('express');
var path = require('path');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDownloadFileHelper = require('./helper/DownloadFileHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var fs = require('fs')
var path = require('path')
var serviceName = 'DownloadFile';

var router = reqExpress.Router();

// Host api to server
router.get('/DownloadFile', function (appRequest, appResponse) {

    var objLogInfo;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'DOWNLOAD_CONTENT'; // correct it
                // Handle the close event when client closes the api request
                appResponse.on('close', function () { // This will call unexpected close from client
                    reqDownloadFileHelper.FinishApiCall(appResponse);
                });
                appResponse.on('finish', function () {
                    reqDownloadFileHelper.FinishApiCall(appResponse);
                });
                appResponse.on('end', function () {
                    reqDownloadFileHelper.FinishApiCall(appResponse);
                });
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var query = appRequest.query;
                var strFilePath = query.FilePath;
                var headers = appRequest.headers;
                // Call hepler class function
                reqDownloadFileHelper.DownloadFile(headers, strFilePath, objLogInfo, function (error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            var fileExt = path.extname(strFilePath).toLowerCase();
                            switch (fileExt) {
                                case ".mp3":
                                    appResponse.set('Content-Type', 'audio/mpeg3');
                                    break;
                                case ".wmv":
                                case ".avi":
                                case ".mp4":
                                    appResponse.set('Content-Type', 'video/mpeg');
                                    break;
                                default:
                                    appResponse.set('Content-Type', 'application/octet-stream');
                                    break;
                            }
                            appResponse.set('Content-Length', Buffer.byteLength(result));
                            saveFile(strFilePath, result, function (responseData) {

                                if (responseData["STATUS"] == "SUCCESS") {
                                    //appResponse.sendFile(__dirname+"\/temp\/"+strFilePath)
                                    appResponse.download(path.resolve('routes/temp/' + strFilePath))
                                }
                                else {
                                    //:todo - change the response
                                    appResponse.send("FAILURE")
                                }
                            })


                            // appResponse.end(result,'binary');
                            //reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-70202', 'Error in reqDownloadFileHelper.DownloadFile callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-70203', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-70204', 'Error in DownloadFile callback', error);
    }
});

function saveFile(filename, data, callback) {



    fs.readdir("./routes/temp/", (err, files) => {
        if (err) throw err;
        if (files.length > 0) {


            for (const file of files) {
                fs.unlink(path.join("./routes/temp/", file), err => {
                    if (err) throw err;
                    var myBuffer = new Buffer.from(data.length);
                    var obj = {};

                    for (var i = 0; i < data.length; i++) {
                        myBuffer[i] = data[i];
                    }
                    fs.writeFile("./routes/temp/" + filename, myBuffer, function (err) {
                        if (err) {
                            obj["STATUS"] = "FAILURE";
                            //obj["FILE_PATH"] = "./temp/"+filename;
                        } else {
                            obj["STATUS"] = "SUCCESS";
                        }
                        callback(obj)
                    });
                });
            }
        } else {
            var myBuffer = new Buffer.from(data.length);
            var obj = {};

            for (var i = 0; i < data.length; i++) {
                myBuffer[i] = data[i];
            }
            fs.writeFile("./routes/temp/" + filename, myBuffer, function (err) {
                if (err) {
                    obj["STATUS"] = "FAILURE";
                    //obj["FILE_PATH"] = "./temp/"+filename;
                } else {
                    obj["STATUS"] = "SUCCESS";
                }
                callback(obj)
            });
        }
    });

}

module.exports = router;
/********* End of Service *********/