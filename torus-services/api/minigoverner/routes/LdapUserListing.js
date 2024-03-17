/*
@Api_Name               :   /LdapUserListing,
@Description            :   To get users details from server using LDAP protocol
@Last_Error_code        :   ERR-MIN-50207
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router();
var cacheLdapHelper = require('./helper/CacheLdapHelper.js');

var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
// var appHelper = require('../../../../torus-references/instance/AppHelper')
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

// Global Variables
var redis_user_detail_key = 'LDAP_USER_DETAIL';
var redis_key = "LDAP_INFO";
var LDAP_FILTER_ATTRIBUTE = "";
var serviceName = 'LdapUserListing';

// Host the api
router.get('/LdapUserListing', function (appRequest, appResponse, pNext) {
    var objLogInfo;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        objLogInfo.PROCESS = 'LdapUserListing-MiniGoverner';
        objLogInfo.ACTION_DESC = 'LdapUserListing';
        objLogInfo.HANDLER_CODE = 'LDAP_USERLISTING';

        var mHeaders = appRequest.headers;
        var config_parsed = {};
        var ldap_key = 'LDAP';
        var PCLIENT_ID = objSessionInfo.CLIENT_ID;
        var filter = appRequest.query.FILTER;

        reqInstanceHelper.PrintInfo(serviceName, 'Getting value from REDIS', objLogInfo)
        reqInstanceHelper.GetRedisValue(ldap_key, mHeaders, function CallbackGetCassandraConn(ldap_result) {
            // reqInstanceHelper.GetConfig(ldap_key + mHeaders.routingkey, function (ldap_result) {
            try {
                var config_parsed = {};
                var result = {};

                if (ldap_result) {
                    config_parsed = JSON.parse(ldap_result);
                    if (config_parsed.LDAP_CONFIG.length) {
                        LDAP_FILTER_ATTRIBUTE = config_parsed.LDAP_CONFIG[0].FILTER_ATTRIBUTE;
                    } else {
                        LDAP_FILTER_ATTRIBUTE = config_parsed.LDAP_CONFIG.FILTER_ATTRIBUTE;
                    }

                } else {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-MIN-50201", "Key LDAP not found in redis", "", "", "")
                    return
                }

                var response = {};

                reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                    reqInstanceHelper.PrintInfo(serviceName, 'getLdapUsers method called', objLogInfo)
                    cacheLdapHelper.getLdapUsers(pCltClient, mHeaders, PCLIENT_ID, objLogInfo, filter, function (reply) {
                        if (reply.STATUS === "SUCCESS") {
                            reply = reply.SUCCESS_DATA;
                            response.filter_attribute = LDAP_FILTER_ATTRIBUTE;
                            response.users = reply;
                            reqInstanceHelper.SendResponse(serviceName, appResponse, response, objLogInfo, null, null, null)
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, reply.ERROR_CODE, reply.ERROR_MESSAGE, reply.ERROR_OBJECT)
                        }
                    });
                });

            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, "ERR-MIN-50207", "Exception Occured", error)
            }
        });
    });
});


module.exports = router;
/******** End of Service *****/