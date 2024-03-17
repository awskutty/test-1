/* 
@Api_Name           : /GetLangJson,
@Description        : To get Language JSON setup against the client
@Last_Error_code    : ERR-AUT-13907
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var pHeaders = {};

//Global Variables

var serviceName = 'GetLangJson';

// Host the GetAppInfo api
router.get('/GetLangJson', function (appRequest, appResponse, pNext) {
    try {
        var objLogInfo;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            objLogInfo.HANDLER_CODE = 'GET_LANG_JSON';
            objLogInfo.PROCESS = 'GetLangJson-Authentication';
            objLogInfo.ACTION = 'GetLangJson';

            // Handle the close event when client closes the api request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
            pHeaders = appRequest.headers;
            appResponse.setHeader('Content-Type', 'application/json');
            var strLangCode = appRequest.query.pLANG;
            var strSubParts = appRequest.query.pPart.split('~');
            var strLang = '';
            reqInstanceHelper.PrintInfo(serviceName, 'GetLangJson method called', objLogInfo)
            GetLangJson(pHeaders, strLangCode, strSubParts, strLang, objLogInfo, function callback(response) {
                try {
                    if (response.STATUS === "SUCCESS") {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                    }
                } catch (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, "ERR-AUT-13905", "Exception occured", error)
                }
            });
        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, "ERR-AUT-13906", "Exception occured during GetLangJSon service call", error)
    }
});



router.post('/GetLangJson', function (appRequest, appResponse, pNext) {
    try {
        var objLogInfo;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            objLogInfo.HANDLER_CODE = 'GET_LANG_JSON';
            objLogInfo.PROCESS = 'GetLangJson-Authentication';
            objLogInfo.ACTION = 'GetLangJson';

            // Handle the close event when client closes the api request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
            pHeaders = appRequest.headers;
            appResponse.setHeader('Content-Type', 'application/json');
            var params = appRequest.body.PARAMS
            var strLangCode = params.pLANG;
            var strSubParts = params.pPart.split('~');
            var strLang = '';
            reqInstanceHelper.PrintInfo(serviceName, 'GetLangJson method called', objLogInfo)

            if (strLangCode && strSubParts) {
                GetLangJson(pHeaders, strLangCode, strSubParts, strLang, objLogInfo, function callback(response) {
                    try {
                        if (response.STATUS === "SUCCESS") {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                        } else {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                        }
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, "ERR-AUT-13905", "Exception occured", error)
                    }
                });
            } else {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, {}, objLogInfo, null, null, null)
            }

        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, "ERR-AUT-13906", "Exception occured during GetLangJSon service call", error)
    }
});

function GetLangJson(headers, strLangCode, strSubParts, strLang, objLogInfo, callback) {
    var resObj = {};
    try {
        pHeaders = headers;
        DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConnt(pClient) {
            reqInstanceHelper.PrintInfo(serviceName, 'strSubParts Length is ' + strSubParts.length, objLogInfo)
            if (strSubParts.length > 2) {
                var Gkeyarr = strSubParts[2].split('-')
                DBInstance.GetTableFromFXDB(pClient, 'language_dictionary_json', ['language_code', 'group', 'group_key', 'ldj_object'], {
                    'language_code': strLangCode.trim(),
                    'client_id': strSubParts[0],
                    'group': strSubParts[1],
                    'group_key': Gkeyarr
                }, objLogInfo, function callbackLang(error, pResult) {
                    try {
                        if (error) {
                            resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-13901", "Error fetching details from language_dictionary_json", error);
                            callback(resObj);
                        } else {
                            for (var i = 0; i < pResult.rows.length; i++) {
                                var obj = pResult.rows[i].ldj_object;
                                obj = obj.replace(/\\/g, "");
                                obj = obj.replace("{", "");
                                obj = obj.replace("}", "");
                                strLang = (strLang === '') ? strLang + obj : strLang + ',' + obj;
                            }
                            strLang = "{" + strLang + "}";
                            resObj = sendMethodResponse("SUCCESS", "", JSON.parse(strLang), "", "", "");
                            callback(resObj);
                        }
                    } catch (error) {
                        resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-13902", "Exception occurs while calling GetLangJson method", error);
                        callback(resObj);
                    }
                })

            } else {
                var Gkeyarr = strSubParts[1].split('-')
                DBInstance.GetTableFromFXDB(pClient, 'language_dictionary_json', ['language_code', 'group_key', 'ldj_object'], {
                    'language_code': strLangCode.trim(),
                    'client_id': strSubParts[0],
                    'group': Gkeyarr
                }, objLogInfo, function callbackLanguageDic(error, pResult) {
                    try {
                        if (error) {
                            resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-13907", "Error fetching details from language_dictionary_json", error);
                            callback(resObj);
                        } else {
                            for (var i = 0; i < pResult.rows.length; i++) {
                                var obj = pResult.rows[i].ldj_object;
                                obj = obj.replace(/\\/g, "");
                                obj = obj.replace("{", "");
                                obj = obj.replace("}", "");
                                strLang = (strLang === '') ? strLang + obj : strLang + ',' + obj;
                            }
                            strLang = "{" + strLang + "}";
                            resObj = sendMethodResponse("SUCCESS", "", JSON.parse(strLang), "", "", "");
                            callback(resObj);
                        }
                    } catch (error) {
                        resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-13903", "Exception occurs while calling GetLangJson method", error);
                        callback(resObj);
                    }
                })
            }
        })
    } catch (error) {
        resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-13904", "Exception occurs while calling GetLangJson method initially", error);
        callback(resObj);
    }
}


function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    }
    return obj
}

module.exports = router;
module.exports.GetLangJson = GetLangJson;


/******** End of Service ********/