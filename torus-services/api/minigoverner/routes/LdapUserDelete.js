/*
@Api_Name            :      /LdapUserDelete,
@Description         :      To delete LDAP user from Torus
@Last_Error_code     :      ERR-MIN-50103
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var ldap = require(node_modules + 'ldapjs');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance =require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

// Global Variables
var mHeaders = '';
var mClient = '';
var serviceName = 'LdapUserDelete'

// Host the api
router.get('/LdapUserDelete', function (appRequest, appResponse, pNext) {
    var objLogInfo = '';
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        try {

            appResponse.on('close', function () {});
            appResponse.on('finish', function () {});
            appResponse.on('end', function () {});

            objLogInfo.PROCESS = 'DeleteLdapUser-MiniGoverner';
            objLogInfo.ACTION_DESC = 'DeleteLdapUser';
            objLogInfo.HANDLER_CODE = 'LDAP_USER_DELETE' 

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

            mHeaders = appRequest.headers;

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                mClient = pCltClient;
                var PCLIENT_ID = objSessionInfo.CLIENT_ID;
                var LOGIN_NAME = objSessionInfo.LOGIN_NAME;
                // delete LDAP user 
                delete_Ldap_User_from_torus(PCLIENT_ID, LOGIN_NAME, function (response) {
                    if (response.STATUS === "SUCCESS") {
                       return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                    } else {
                       return reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                    }
                });
            });
        } catch (error) {
           return reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, 'ERR-MIN-50103', 'Exception occured', error)
        }

        // method for deleting Ldap user from torus
        delete_Ldap_User_from_torus = function (PCLIENT_ID, LOGIN_NAME, callback) {
            var response = {};
            reqInstanceHelper.PrintInfo(serviceName, 'Deleting from users table', objLogInfo)
            reqFXDBInstance.DeleteFXDB(mClient, 'users', {
                'login_name': LOGIN_NAME,
                'client_id': PCLIENT_ID
            }, objLogInfo, function callbackDelete(error, pResult) {
                try {
                    console.log("RES"+JSON.stringify(pResult))
                    console.log("RES ERR"+JSON.stringify(error))
                    if (error) {
                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50101', "User Deletion Failed", error))
                    } else {
                        callback(sendMethodResponse("SUCCESS", "User Deleted Successfully", response, '', '', ''))
                    }
                } catch (error) {
                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50102', "Exception Occured", error))
                }
            });
        }
    });
});

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
/******** End of Service *****/