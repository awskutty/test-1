/*
@Api_Name         : /Update Content,
@Description      : To Update the trna_data table img data
*/

// Require dependencies
var reqExpress = require('express');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
// var path = require('path');
router.post('/UpdateAttachment', function (appRequest, appResponse) {
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pobjLogInfo, psession_info) {
            var objLogInfo = pobjLogInfo;
            var pHeaders = appRequest.headers;
            var params = appRequest.body;
            var arrFiles = appRequest.files;
            var byteData = params.byteData;
            var strServiceName = "UpdateAttachment";

            var intFileCnt = Object.keys(arrFiles).length;
            var objCurAtmtDetails = JSON.parse(params.RSPARAMS).Items[0];

            //var objCurAtmtDetails = arrAtmtDetails;
            var relativePath = objCurAtmtDetails.RELATIVE_PATH;
            // var strFileExtension = path.extname(objCurAtmtDetails.FILE_NAME);
            var atCode = objCurAtmtDetails.AT_CODE;
            //var strLiterName = path.basename(objCurAtmtDetails.FILE_NAME, strFileExtension);

            var byteData = '';
            for (var i = 0; i < intFileCnt; i++) {
                if (objCurAtmtDetails.FILE_NAME == arrFiles["FILE_" + i].name)
                    byteData = arrFiles["FILE_" + i].data;
            }

            // Handle the close event when client closes the api request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            reqDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function (pClient) {

                _getTradId().then(function (res) {
                    if (res.rows.length) {
                        _PrintInfo("Got trnaId from TRNA_DATA, Going to update trna data", objLogInfo);
                        var TrnAId = res.rows[0].trnad_id.toString();
                        _UpdateTranData(TrnAId).then(function (res) {
                            _PrintInfo("TRNA_DATA update success ", objLogInfo);
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, "SUCCESS", objLogInfo, null, null, null);
                        }).catch(function (error) {
                            _PrintInfo("Error occured " + error.error.ErrMsg + " " + error.Err + " " + error.ErrCode, objLogInfo);
                            sendErrResponse(error);
                        });
                    } else {
                        _PrintInfo("TrnaId not found for Relative path " + relativePath, objLogInfo);
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-', 'No Data Found', '');
                    }
                }).catch(function (error) {
                    _PrintInfo("Error occured " + error.error.ErrMsg + " " + error.Err + " " + error.ErrCode, objLogInfo);
                    sendErrResponse(error);
                });

                function _getTradId() {
                    return new Promise(function (resolve, reject) {
                        try {
                            _PrintInfo("_getTradId function called", objLogInfo);
                            var pCond = {};
                            pCond.relative_path = relativePath;
                            reqDBInstance.GetTableFromFXDB(pClient, "TRNA_DATA", ['TRNAD_ID'], pCond, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    var errObj = {
                                        Err: pErr,
                                        ErrCode: "ERR-RES-70401",
                                        ErrMsg: "Error Occured while get TRNAD_ID from TRNA_DATA"
                                    };
                                    reject(errObj);
                                } else {
                                    resolve(pRes);
                                }
                            });
                        } catch (error) {
                            var errObj = {
                                Err: error,
                                ErrCode: "ERR-RES-70402",
                                ErrMsg: "Exception Occured _getTradId function "
                            };
                            reject(errObj);
                        }
                    });
                }

                function _UpdateTranData(pTrnAId) {
                    return new Promise(function (resolve, reject) {
                        try {
                            var pRow = {};
                            if (atCode.toUpperCase() == "IMG") {
                                pRow.TEXT_DATA = new Buffer.from(byteData).toString('base64');;
                            } else {
                                pRow.BYTE_DATA = byteData;
                            }
                            var UpdateCond = {};
                            UpdateCond.RELATIVE_PATH = relativePath;
                            UpdateCond.TRNAD_ID = pTrnAId;
                            reqDBInstance.UpdateFXDB(pClient, "TRNA_DATA", pRow, UpdateCond, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    var errObj = {
                                        Err: pErr,
                                        ErrCode: "ERR-RES-70403",
                                        ErrMsg: "Error Occured while update data on TRNA_DATA table"
                                    };
                                    reject(errObj);
                                } else {
                                    resolve();
                                }
                            });
                        } catch (error) {
                            var errObj = {
                                Err: error,
                                ErrCode: "ERR-RES-70400",
                                ErrMsg: "Exception ocuured while _UpdateTranData function call"
                            };
                            reject(errObj);
                        }
                    });
                };
            });

            function _PrintInfo(pMessage, objLogInfo) {
                reqInstanceHelper.PrintInfo(strServiceName, pMessage, objLogInfo);
            }

            function sendErrResponse(pErr) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, "FAILURE", objLogInfo, pErr.ErrCode, pErr.ErrMsg, pErr.ErrMsg);
            };

        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, "FAILURE", objLogInfo, "ERR-RES-70404", "Exception occured ", error);
    }
});
module.exports = router;
