/*
@Api_Name               :       /SearchUser,
@Description            :       To search user
@Last_Error_code        :       ERR-MIN-51107
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqStringBuilder = require(node_modules + 'string-builder');
var reqLINQ = require(node_modules + "node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance =require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var x = '0';
var serviceName = "SearchUser"

// Host the api
router.post('/SearchUser', function(appRequest, appResponse, next) {
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.HANDLER_CODE = 'SEARCH_USER';
        objLogInfo.PROCESS = 'SearchUser-Minigoverner';
        objLogInfo.ACTION_DESC = 'SearchUser';

        appResponse.on('close', function() {});
        appResponse.on('finish', function() {});
        appResponse.on('end', function() {});
        var Search_login_name;
        try {
            var mHeaders = appRequest.headers;

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {

                var mClient = pCltClient;
                // get the paramerters from client 
                Search_login_name = appRequest.body.PARAMS.SEARCH_LOGIN_NAME;
                var Client_id = objSessionInfo.CLIENT_ID;
                reqInstanceHelper.PrintInfo(serviceName, 'Calling SearchUser method', objLogInfo)
                SearchUser(function(response) {
                    if (response.STATUS === "SUCCESS") {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                    }
                });

                // search user method
                function SearchUser(callback) {
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, 'Querying users table', objLogInfo)
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'users', ['u_id', 'login_name'], {
                            'client_id': Client_id
                        }, objLogInfo, function callbacksearchuser(error, pResult) {
                            try {
                                if (error) {
                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51103', 'Error while fetching users table', error))
                                } else {

                                    //Form the result into a array using LINQ
                                    var arrUser = new reqLINQ(pResult.rows)
                                        .Where(function(u) {
                                            return u.login_name.toUpperCase().startsWith(Search_login_name.toUpperCase())
                                        }).ToArray();
                                    var arrUserID = new reqLINQ(arrUser)
                                        .Select(function(u) {
                                            return u.u_id;
                                        }).ToArray();
                                    reqInstanceHelper.PrintInfo(serviceName, 'Querying app_users table', objLogInfo)
                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'app_users', ['appu_id', 'u_id'], {
                                        'u_id': arrUserID
                                    }, objLogInfo, function callbackAppUsers(error, pResult) {
                                        try {
                                            if (error) {
                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51104', 'Error while fetching app_users table', error))
                                            } else {
                                                _SearchUser(pResult, arrUser, function(response) {
                                                    callback(response)
                                                });
                                            }
                                        } catch (error) {
                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51105', 'Exception occurs', error))
                                        }
                                    })
                                }
                            } catch (error) {
                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51106', 'Exception occurs', error))
                            }
                        });

                    } catch (error) {
                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51107', 'Exception occurs', error))
                    }
                }

                //Prepare JSON to Client using string builder
                function _SearchUser(pAppUser, pUsers, callback) {
                    try {
                        var sbUser = new reqStringBuilder();
                        sbUser.append('{"USERS" : [');
                        var x = 0;
                        for (var i = 0; i < pUsers.length; i++) {
                            var blnExist = false;
                            for (var j = 0; j < pAppUser.rows.length; j++) {
                                if (pUsers[i].u_id == pAppUser.rows[j].u_id) {
                                    blnExist = true;
                                    break;
                                }
                            }
                            if (!blnExist) {
                                if (x == 0) {
                                    sbUser.append("{");
                                }
                                if (x > 0) {
                                    sbUser.append(",");
                                    sbUser.append("{");
                                }
                                sbUser.appendFormat("\"LOGIN_NAME\":\"{0}\",\"U_ID\":\"{1}\"", pUsers[i].login_name, pUsers[i].u_id);
                                x++;
                                sbUser.append("}");
                            }
                        }
                        sbUser.append("]}");
                        callback(sendMethodResponse("SUCCESS", '', JSON.stringify(sbUser), '', '', ''))

                    } catch (error) {
                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51101', 'Exception occured in _SearchUser method', error))
                    }
                }
            });
        } catch (error) {
            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51102', 'Exception occured', error))
        }
    });
})

// Method to form response object
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