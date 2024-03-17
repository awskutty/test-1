/*
    @Api_Name           : /DownloadFile,
    @Descriptions       : query the Ex_header_files table get the file_content and create file in local machine   
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var path = require('path');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var fs = require('fs');
var path = require('path');

router.get('/DownloadToLocal', function (appRequest, appResponse) {
    try {
        var serviceName = 'DownloadFile';
        var fileName = appRequest.query.fileName;
        var mHeaders = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfoobj, objSessionInfo) {
            try {
                var pCond = {
                    file_name: fileName
                };
                var dir = "./temp/"
                if (fs.existsSync(dir + fileName)) {
                    appResponse.download(path.resolve('./temp/' + fileName))
                } else {
                    reqTranDBHelper.GetTranDBConn(mHeaders, false, function (pDBConn) {
                        try {
                            reqTranDBHelper.GetTableFromTranDB(pDBConn, 'ex_header_files', pCond, objLogInfoobj, function (pRes, pErr) {
                                if (pErr) {

                                } else {
                                    if (pRes.length) {
                                        var filecontent = pRes[0].file_content;
                                        CheckFolderandCreateFile(fileName, filecontent, function (responseData) {
                                            if (responseData["STATUS"] == "SUCCESS") {
                                                appResponse.download(path.resolve('./temp/' + fileName));
                                            }
                                            else {
                                                appResponse.send("file not found")
                                            }
                                        })
                                    } else {
                                        appResponse.send("FAILURE")
                                    }
                                }
                            })
                            function CheckFolderandCreateFile(filename, data, callback) {
                                try {
                                    var obj = {};
                                    if (fs.existsSync(dir)) {
                                        if (fs.existsSync(dir + filename)) {
                                            obj["STATUS"] = "SUCCESS";
                                            callback(obj)
                                        } else {
                                            createFile()
                                        }
                                    } else {
                                        fs.mkdirSync(dir)
                                        createFile()
                                    }
                                    function createFile() {
                                        try {
                                            fs.writeFile("./temp/" + filename, data, function (err) {
                                                if (err) {
                                                    obj["STATUS"] = "FAILURE";
                                                } else {
                                                    obj["STATUS"] = "SUCCESS";
                                                }
                                                callback(obj)
                                            });
                                        } catch (error) {
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, {}, 'ERR-EXG_005', 'Exception Occured createFile', error, "", "");
                                        }
                                    }
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, {}, 'ERR-EXG_004', 'Exception Occured CheckFolderandCreateFile', error, "", "");
                                }

                            }
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, {}, 'ERR-EXG_003', 'Exception Occured GetTranDBConn', error, "", "");
                        }
                    })
                }
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, {}, 'ERR-EXG_002', 'Exception Occured AssignLogInfoDetail', error, "", "");
            }
        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, {}, 'ERR-EXG_001', 'Exception Occured', error, "", "");
    }
})
module.exports = router;
/********* End of Service *********/