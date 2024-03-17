/* 
@Api_Name           : /BindAttachmentCategory,
@Description        : To get dtt dfd_json details from dtt_info,
@Last_Error_code    : ERR-HAN-41904
*/

// Require dependencies
var reqDBInstance = require('../../../../torus-references/instance/DBInstance')
var reqLINQ = require("node-linq").LINQ;
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();

// Global variable initialization
var strServiceName = "BindAttachmentCategory";

// Host the Method to express
router.post('/BindAttachmentCategory', function(appRequest, appResponse) {
    var objLogInfo;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, sessionInfo) {

            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});

            reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
            objLogInfo.HANDLER_CODE = 'BIND_ATTACHMENT_CATEGORY';
            var APPID = sessionInfo.APP_ID;
            var DTTCODE = appRequest.body.PARAMS.DTT_CODE;

            const DTTINFOSEL = 'Select * from dtt_info where app_id = ? and dtt_code = ?';
            BindAttachmentCategory();

            // Query dtt_info table
            function BindAttachmentCategory() {
                pHeaders = appRequest.headers;
                reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                    reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra Session Initiated Successfully', objLogInfo);
                    var mClient = pClient;
                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying dtt_info table', objLogInfo);
                    reqDBInstance.GetTableFromFXDB(mClient, 'dtt_info', [], {
                        'APP_ID': APPID,
                        'DTT_CODE': DTTCODE
                    }, objLogInfo, function callbackDTTINFOSEL(err, pResult) {
                        try {
                            if (err)
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-HAN-41901', 'Querying dtt_info table have been Failed', err, '', '');
                            else {
                                try {
                                    var dttjson = {};
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result From dtt_info table', objLogInfo);
                                    for (var i = 0; i < pResult.rows.length; i++) {
                                        dttjson = pResult.rows[i].dtt_dfd_json
                                        dttjson = dttjson.toString().replace(/\\/g, '');
                                    }
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, dttjson, objLogInfo, '', '', '', '', '');
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-HAN-41902', 'Error while processing Callback from dtt_info table', error, '', '');
                                }
                            }
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-HAN-41903', 'Error in Callback function', error, '', '');
                        }
                    })
                });
            }
        })
    } catch (error) {
        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-HAN-41904', 'Error while starting BindAttachmentCategory API function', error, '', '');
    }
});


module.exports = router;
/*********** End of Service **********/