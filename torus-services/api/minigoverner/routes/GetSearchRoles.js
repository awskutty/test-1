/*
@Api_Name        : /GetSearchRoles,
@Description     : To search roles
@Last_Error_code : ERR-MIN-51505
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqLinq = require(node_modules + "node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance =require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

// Initialize member variables
var mRoleSearch = '';
var mAppID = '';
var serviceName = "GetSearchRoles"

// Host the GetSearchRoles api
router.post('/GetSearchRoles', function (appRequest, appResponse, next) {
    var objLogInfo = '';
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        objLogInfo.HANDLER_CODE = 'GET_SEARCH_ROLES'
        objLogInfo.PROCESS = 'SearchRoles-Minigoverner';
        objLogInfo.ACTION_DESC = 'SearchRoles';

        appResponse.on('close', function () {});
        appResponse.on('finish', function () {});
        appResponse.on('end', function () {});

        try {
            var mHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mClient = pCltClient;
                var strInputParamJson = appRequest.body.PARAMS;

                // Initialize local variables
                var strInputParam = appRequest.body.PARAMS;

                reqInstanceHelper.PrintInfo(serviceName, '_InitializeParams called', objLogInfo)
                _InitializeParams(strInputParam, function (response) {
                    if (response.STATUS === "SUCCESS") {
                        SearchRoles(function (response) {
                            if (response.STATUS === "SUCCESS") {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                            } else {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                            }
                        })
                    } else {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                    }
                })

                //Prepare roles search function
                function SearchRoles(callback) {
                    try {
                        var objRoles = {};
                        var arrSearchRoles = [];
                         reqInstanceHelper.PrintInfo(serviceName, 'Querying app_roles table', objLogInfo)
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_roles', ['appr_id', 'role_code', 'role_description'], {
                            'app_id': mAppID
                        }, objLogInfo, function calbackRoles(error, pResult) {
                            try {
                                if (error) {
                                    callback(sendMethodResponse("FAILURE", "", "", "ERR-MIN-51505", "Querying app_roles table", error))
                                } else {
                                    var arrRoles;
                                    if (mRoleSearch != '') {
                                        arrRoles = new reqLinq(pResult.rows)
                                            .Where(function (u) {
                                                return u.role_description.toUpperCase().startsWith(mRoleSearch.toUpperCase())
                                            }).ToArray();
                                    } else {
                                        arrRoles = pResult.rows
                                    }
                                    // To form the roles JSON
                                    for (var i = 0; i < arrRoles.length; i++) {
                                        var objRole = {};
                                        objRole.APPR_ID = arrRoles[i].appr_id;
                                        objRole.ROLE_CODE = arrRoles[i].role_code;
                                        objRole.ROLE_DESCRIPTION = arrRoles[i].role_description;
                                        arrSearchRoles.push(objRole);
                                    }
                                    objRoles.ROLES = arrSearchRoles;

                                    callback(sendMethodResponse("SUCCESS", "", objRoles, "", "", ""))
                                }
                            } catch (error) {
                                callback(sendMethodResponse("FAILURE", "", "", "ERR-MIN-51502", "Exception occured", error))
                            }
                        })

                    } catch (error) {
                        callback(sendMethodResponse("FAILURE", "", "", "ERR-MIN-51503", "Exception occured", error))
                    }
                }
            });
        } catch (error) {
            callback(sendMethodResponse("FAILURE", "", "", "ERR-MIN-51504", "Exception occured", error))
        }

        // Do the params initialization
        function _InitializeParams(pParams, callback) {
            try {
                // Check the APP_ID
                if (pParams.APP_ID != undefined && pParams.APP_ID != '')
                    mAppID = pParams.APP_ID;
                // Check the ROLE_SEARCH-Given Search Condition
                if (pParams.ROLE_SEARCH != undefined && pParams.ROLE_SEARCH != '') {
                    mRoleSearch = pParams.ROLE_SEARCH;
                } else {
                    mRoleSearch = '';
                }

                callback(sendMethodResponse("SUCCESS", "", "", "", "", ""))
            } catch (error) {
                callback(sendMethodResponse("FAILURE", "", "", "ERR-MIN-51501", "Exception occured", error))
            }

        }

    })
})

// method to form response object
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
//*******End of Service*******//