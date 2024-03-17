/*
@Api_Name : /Gettenantsetup,
@Description: For bypasssigin- Get the tenant_setup value from given category, and put insert into redis
@Last_Error_Code:ERR-AUT-16004
*/

var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var redis = require(modPath + "redis");
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

router.post('/Gettenantsetup', function (appRequest, appResponse) {
    var servicename = 'Gettenantsetup';
    var ClientID = appRequest.body.PARAMS.CLIENT_ID;
    var tenantID = appRequest.body.PARAMS.TENANT_ID;
    var Category = appRequest.body.PARAMS.CATEGORY;
    var Key = appRequest.body.PARAMS.SITE_NAME;
    var sitename;
    if (Key != null && Key != '' && Key != undefined) {
        sitename = Category + '_' + Key
    } else {
        sitename = Category;
    }
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
        try {
            reqInstanceHelper.PrintInfo(servicename, 'Begin', objLogInfo);
            var pHeaders = appRequest.headers;
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                // Handle the close event when client close the connection
                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                gettenantsetup();
                function gettenantsetup() {
                    try {
                        reqInstanceHelper.PrintInfo(servicename, 'gettenantsetup function called', objLogInfo);
                        reqInstanceHelper.PrintInfo(servicename, 'Query TENANT_SETUP table  with category is ' + sitename, objLogInfo);
                        DBInstance.GetTableFromFXDB(pClient, 'TENANT_SETUP', [], {
                            'CLIENT_ID': ClientID,
                            'TENANT_ID': tenantID,
                            'CATEGORY': sitename
                        }, objLogInfo, function (err, result) {
                            try {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-AUTH-16001', 'error while execute tenat_setup select query', err, 'FAILURE', '');
                                } else {
                                    if (result.rows.length > 0) {
                                        reqInstanceHelper.PrintInfo(servicename, 'Got Bypasssignin Sessions from tenant_setup', objLogInfo);
                                        var setupjson = result.rows[0].setup_json;

                                        var parseddata = JSON.parse(setupjson);
                                        if (Key) {
                                            var RedisKey = 'PORTALSERVICE-' + parseddata.SESSION_ID;
                                            parseddata.SESSION_ID = RedisKey;
                                        }
                                        var res = JSON.stringify(parseddata);
                                        reqInstanceHelper.SendResponse(servicename, appResponse, res, objLogInfo, '', '', '', 'SUCCESS', '');
                                    } else {
                                        reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, '', 'No Rows Found in Tenant_setup for ByPassSignIn', '', 'FAILURE', '');
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-AUTH-16002', 'Exception occured while execute tenat_setup select query', error, 'FAILURE', '');
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-AUTH-16003', 'Exception occured while execute tenat_setup select query', error, 'FAILURE', '');
                    }

                }
            })
        } catch (error) {
            reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-AUTH-16004', 'Exception occured while execute tenat_setup select query', error, 'FAILURE', '');
        }

    })
})
module.exports = router;
/************ End of Service ***********/