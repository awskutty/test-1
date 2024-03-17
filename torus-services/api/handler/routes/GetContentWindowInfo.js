/*
@Api_Name           : /GetContentWindowInfo,
@Description        : To get the details needed for Add Content popup - Attachment types, dt_info and dtt_info details
@Last_Error_code    : ERR-HAN-40412
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLinq = require('node-linq').LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')
var strServiceName = 'GetContentWindowInfo'
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Global variable initialization 


// Host api to server
router.post('/GetContentWindowInfo', function (appRequest, appResponse, next) {
    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {

            // Handle the api close event when client close the request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            _PrintInfo('Begin')
            objLogInfo = pLogInfo
            // Initialize local variables
            var strInputParamJson = appRequest.body.PARAMS;
            var strAppId = session_info.APP_ID;
            var strDttCode = appRequest.body.PARAMS.DTT_CODE;
            var strDtCode = appRequest.body.PARAMS.DT_CODE;
            var arrAtmtType = [];
            var arrDTTInfo = [];
            var arrDTInfo = [];
            var strChildDTTRel = '';
            objLogInfo.HANDLER_CODE = 'LOAD_ADD_CONTENT';
            // Function call
            _PrepareAtmtType();

            // To query and prepare the Atttachment Types table
            function _PrepareAtmtType() {
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(mClient) {
                        var objAtmtType = {};
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'attachment_types', ['at_code', 'at_extensions'], {}, objLogInfo, function callbackSelA(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40401', 'Error In attachment_types Table Execution', pError);
                            } else if (pResult) {
                                try {
                                    for (i = 0; i < pResult.rows.length; i++) {
                                        objAtmtType = {};
                                        objAtmtType.AT_CODE = pResult.rows[i].at_code;
                                        objAtmtType.AT_EXTENSION = pResult.rows[i].at_extensions;
                                        arrAtmtType.push(objAtmtType);
                                    }
                                    _PrepareDTInfo(mClient);
                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40402', 'Error in _PrepareAtmtType-SELATMTTYPES:', error);
                                }
                            }
                        });
                    });
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40403', 'Error in _PrepareAtmtType function:', error);
                }
            }

            // TO Prepare DTinfo
            function _PrepareDTInfo(mClient) {
                try {
                    var objDTInfo = {};
                    reqFXDBInstance.GetTableFromFXDB(mClient, 'dt_info', ['app_id', 'dt_code', 'dt_description', 'relation_json'], {
                        dt_code: strDtCode,
                        app_id: strAppId
                    }, objLogInfo, function callbackSelA(pError, pResult) {
                        if (pError) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40404', 'Error in dt_info table execution:', pError);

                        } else if (pResult) {
                            try {
                                if (pResult.rows.length > 0) {
                                    var strDTInfoRelJoson = pResult.rows[0].relation_json;
                                    var strRelJson = JSON.parse(strDTInfoRelJoson);
                                    objDTInfo.DTT_DESCRIPTION = 'Select';
                                    objDTInfo.DTT_CODE = '';
                                    arrDTInfo.push(objDTInfo)
                                    _PrepareChildDttRelation(strRelJson, strDtCode, mClient);
                                } else {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40412', 'No Rows Found in dt_info', "", "");
                                }
                            } catch (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40405', 'Error in _PrepareDTInfo-SELDTINFO', error);
                            }
                        }
                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40406', 'Error in _PrepareDTInfo function', error)

                }
            }

            // To Prepare Child Dtt Relation
            function _PrepareChildDttRelation(strRelJson, strdtcode, mClient) {
                try {
                    if (strRelJson[0].CHILD_DTT_RELEATIONS.length > 0) {
                        strChildDTTRel = strRelJson[0].CHILD_DTT_RELEATIONS;
                        for (var i = 0; i < strChildDTTRel.length; i++) {
                            if (strChildDTTRel[i].CATEGORY == 'S') {
                                objChildDTTRel = {};
                                objChildDTTRel.DTT_CATEGORY = strChildDTTRel[i].CATEGORY;
                                objChildDTTRel.DTT_DESCRIPTION = strChildDTTRel[i].DTT_DESCRIPTION;
                                objChildDTTRel.DTT_CODE = strChildDTTRel[i].DTT_CODE;
                                objChildDTTRel.TARGET_TABLE = strChildDTTRel[i].TARGET_TABLE;
                                arrDTInfo.push(objChildDTTRel);
                                if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                                    strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS;
                                    _PrepareChildDttRelation(strChildDTTRel,strdtcode,mClient);
                                }
                            } else if (strChildDTTRel[i].CATEGORY == 'T') {
                                if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                                    strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS;
                                    _PrepareChildDttRelation(strChildDTTRel,strdtcode,mClient);
                                }
                            }
                        }
                    }
                    _PrepareDTTInfo(strdtcode, mClient)
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40407', 'Error in _PrepareChildDttRelation function', error)
                }
            }
            //To prepare DTT_INFO
            function _PrepareDTTInfo(pDtCode, mClient) {
                try {
                    reqFXDBInstance.GetTableFromFXDB(mClient, 'dtt_info', ['app_id', 'dtt_code', 'dtt_description', 'dtt_dfd_json'], {
                        dtt_code: strDttCode,
                        app_id: strAppId
                    }, objLogInfo, function callbackSelA(pError, pResult) {
                        if (pError) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40408', 'Error in _PrepareDTTInfo-arrDTTInfo,objAtmtInfo:n', pError)
                        } else if (pResult) {
                            try {
                                if (pResult.rows.length > 0) {
                                    var strDttInfoDFDJson = pResult.rows[0].dtt_dfd_json.toString().replace(/\\/g, '');
                                    var strDttDfdJson2 = JSON.parse(strDttInfoDFDJson);
                                    var objDttAtmt = {};
                                    var objDttAtmtDet = {};
                                    var objImgFormat = {};

                                    if (strDttDfdJson2.DTT_ATTACHMENT != '') {
                                        var strDttAtmt = strDttDfdJson2.DTT_ATTACHMENT;

                                        for (var i = 0; i < strDttAtmt.length; i++) {
                                            objDttAtmt = {};
                                            objDttAtmt.DTTA_ID = strDttAtmt[i].DTTA_ID;
                                            objDttAtmt.ATTACH_TITLE = strDttAtmt[i].ATTACH_TITLE;
                                            objDttAtmt.ATTACH_TYPE = strDttAtmt[i].ATTACH_TYPE;
                                            if (strDttAtmt[i].DTTA_DETAILS != '') {
                                                var dd = strDttAtmt[i].DTTA_DETAILS;
                                                for (var j = 0; j < dd.length; j++) {
                                                    objDttAtmtDet = {}
                                                    objDttAtmtDet.DTTAD_ID = dd[j].DTTAD_ID;
                                                    objDttAtmtDet.LABEL_NAME = dd[j].LABEL_NAME
                                                    if (dd[j].DTTAD_IMG_FORMAT != '') {
                                                        var ee = dd[j].DTTAD_IMG_FORMAT;
                                                        var objDttInfoDet = {};
                                                        for (var k = 0; k < ee.length; k++) {
                                                            objImgFormat.DTTADIF_ID = ee[k].DTTADIF_ID;
                                                            objImgFormat.IMG_FORMAT = ee[k].IMG_FORMAT;
                                                            objDttInfoDet.DT_CODE = pDtCode;
                                                            objDttInfoDet.DTTA_ID = objDttAtmt.DTTA_ID;
                                                            objDttInfoDet.DTTAD_ID = objDttAtmtDet.DTTAD_ID;
                                                            if (objImgFormat.DTTADIF_ID != '' && objImgFormat.DTTADIF_ID != null && objImgFormat.DTTADIF_ID != undefined) {
                                                                objDttInfoDet.DTTADIF_ID = objImgFormat.DTTADIF_ID;
                                                            } else {
                                                                objDttInfoDet.DTTADIF_ID = 'null'
                                                            }
                                                            objDttInfoDet.IMAGE_LABEL_NAME = objDttAtmtDet.LABEL_NAME;
                                                            objDttInfoDet.ATTACHMENT_TITLE = objDttAtmt.ATTACH_TITLE;
                                                            objDttInfoDet.IMAGE_FORMAT = objImgFormat.IMG_FORMAT;
                                                            objDttInfoDet.AT_CODE = objDttAtmt.ATTACH_TYPE;
                                                            arrDTTInfo.push(objDttInfoDet);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    var objAtmtInfo = {};
                                    var objAtTypesInfo = {};
                                    objAtTypesInfo['DTT_INFO'] = arrDTInfo;
                                    objAtTypesInfo['ATDETAIL'] = arrDTTInfo;
                                    objAtTypesInfo['AT_TYPES'] = arrAtmtType;
                                    objAtmtInfo['ATMTINFO'] = objAtTypesInfo;
                                    reqInsHelper.SendResponse(strServiceName, appResponse, objAtmtInfo, objLogInfo, null, null);
                                } else {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, null, null);
                                }
                            } catch (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40409', 'Error in _PrepareDTTInfo-arrDTTInfo,objAtmtInfo:n', pError)
                            }
                        }
                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40410', 'Error in _PrepareDTTInfo function', error)
                }
            }
        })

    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40411', 'Error in _GetContentWindowInfo', error)
    }

    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }
    // Print Log Error
    function _PrintErr(pError, pErrorCode, pMessage) {
        reqInsHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage)
    }
});

module.exports = router;
/*********** End of Service *********/