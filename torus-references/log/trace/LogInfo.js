/**
 @Decsription : Loginfo object 
 @LAST_ERROR_CODE : ERR_LOGINFO_0003
 */

// Require dependencies
var serviceName = 'LogInfo';
var reqUuid = require('uuid');
var reqInstanceHelper = require('../../common/InstanceHelper');

var ConnId = 0;
//global.Log = [];
function LogInfo() {
    // Common proprties
    this.PRCT_ID = '';
    this.APP_ID = '';
    this.APP_DESC = '';
    this.USER_ID = '';
    this.USER_NAME = '';
    this.SYSTEM_ID = '';
    this.SYSTEM_DESC = '';
    this.HANDLER_CODE = '';
    this.MESSAGE = '';
    this.SERVICEURL = '';
    this.SESSION_ID = '';
    this.CLIENTURL = '';
    this.PROCESS = '';
    this.STARTTIME = '';
    this.ENDTIME = '';
    //Trace Log details
    this.LOGTYPE = '';
    this.MENU_ITEM_DESC = '';
    this.PARENT_PROCESS = '';
    this.ACTION_DESC = '';
    this.ERROR_CODE = '';

    // Service info
    this.SERVICE_TYPE = '';
    this.SERVICE_NAME = '';
    this.STATUS = '';

    // Audit Info
    this.DT_CODE = "";
    this.DT_DESCRIPTION = "";
    this.DTT_CODE = "";
    this.DTT_DESCRIPTION = "";
    this.RECORD_ID = "";
    this.COLUMN_NAME = "";
    this.OLD_VALUE = "";
    this.NEW_VALUE = "";
    this.NEED_INSERT = "";
    this.headers = {};

}

// Assign Log info params from redis session id
function assignLogInfoDetail(appRequest, callback) {
    try {
        var reqInstanceHelper = require('../../common/InstanceHelper');
        var reqLogWriter = require('./LogWriter');
        var objLogInfo = {};
        var objSessionInfo = {};
        var sessionId = '';
        var params = '';
        var reqBody = {};

        sessionId = appRequest.headers['session-id'];
        if (appRequest.method == 'GET') {
            params = appRequest.query || {};
            reqBody = appRequest.query || {};
            if (!sessionId) {
                sessionId = params.SESSION_ID;
            }
        } else {
            params = appRequest.body.PARAMS || {};
            reqBody = appRequest.body || {};
            if (!sessionId) {
                sessionId = appRequest.body.SESSION_ID;
            }
        }
        var redisKey = sessionId ? sessionId : '';
        redisKey = 'SESSIONID-' + redisKey;
        reqInstanceHelper.GetConfig(redisKey, function (sessionValue, error) {
            try {
                if (error) {
                    return callback(objLogInfo, objSessionInfo);
                } else {
                    sessionValue = JSON.parse(sessionValue);
                    if (sessionValue.length == undefined) {
                        objSessionInfo = sessionValue ? sessionValue : {};
                    } else {
                        objSessionInfo = sessionValue[1] ? sessionValue[1] : {};
                        objLogInfo.PARENT_SYS_TYPE_FOR_ROUTING = sessionValue[0].PARENT_SYS_TYPE_FOR_ROUTING;
                        objLogInfo.NEED_SYSTEM_ROUTING = sessionValue[0].NEED_SYSTEM_ROUTING;
                        objSessionInfo.SESSION_ID = sessionId;
                        objSessionInfo.ROUTINGKEY = appRequest.headers['routingkey'];
                    }
                    objLogInfo.arrConns = [];
                    //var prct_id = getConnectionId(); //(Date.now() / 100000000000).toString().split('.')[1].substring(0, 10);
                    objLogInfo.APP_DESC = objSessionInfo.APP_DESC;
                    objLogInfo.APP_ID = objSessionInfo.APP_ID;
                    objLogInfo.APP_CODE = objSessionInfo.APP_CODE ? objSessionInfo.APP_CODE : "";
                    objLogInfo.APPSTS_ID = objSessionInfo.APPSTS_ID;
                    //objLogInfo.USER_NAME = objSessionInfo.USER_NAME;
                    objLogInfo.LOGIN_NAME = objSessionInfo.LOGIN_NAME;
                    objLogInfo.USER_ID = objSessionInfo.USER_ID;
                    objLogInfo.SYSTEM_ID = objSessionInfo.SYSTEM_ID;
                    objLogInfo.ST_CODE = objSessionInfo.ST_CODE;
                    objLogInfo.SYSTEM_DESC = objSessionInfo.SYSTEM_DESC;
                    objLogInfo.SESSION_ID = objSessionInfo.SESSION_ID;
                    objLogInfo.TENANT_ID = objSessionInfo.TENANT_ID;
                    objLogInfo.NEED_EXT_AUTH = objSessionInfo.NEED_EXT_AUTH;
                    objLogInfo.EXT_AUTH_TOKEN_BLOCKCHAIN = objSessionInfo.EXT_AUTH_TOKEN_BLOCKCHAIN;
                    objLogInfo.PRCT_ID = getConnectionId();
                    objLogInfo.ROUTING_KEY = appRequest.headers['routingkey'];
                    // objLogInfo.PRCT_ID = objSessionInfo.PRCT_ID ? objSessionInfo.PRCT_ID : reqUuid.v1();
                    objLogInfo.HANDLER_CODE = params.HANDLER_CODE;
                    objLogInfo.PROCESS = params.MENU_ITEM_DESC;
                    objLogInfo.ACTION = params.ACTION_DESC;
                    objLogInfo.CLIENTURL = appRequest.headers.referer ? appRequest.headers.referer : '';
                    objLogInfo.SERVICEURL = appRequest.headers.host + appRequest.originalUrl;
                    objLogInfo.NEED_INSERT = 'N';
                    objLogInfo.headers = appRequest.headers;
                    objLogInfo.DB_MODE = params.DB_MODE || ''
                    console.log("appRequest.headers['x-forwarded-for']" + appRequest.headers['x-forwarded-for']);
                    try {
                        if (appRequest.headers['x-forwarded-for']) {
                            objLogInfo.CLIENTIP = appRequest.headers['x-forwarded-for'].split(',')[0];
                        } else {
                            objLogInfo.CLIENTIP = '';//appRequest.connection.remoteAddress.split(':')[3];}
                        }
                    } catch (error) {
                        console.log(error);
                    }
                    objLogInfo.CLIENTTZ = appRequest.headers.clienttz || ''; //browser time zone name 
                    objLogInfo.CLIENTTZ_OFFSET = appRequest.headers.clienttz_offset || '';//browsert time zone offset

                    // This Check is Mainly For Any Framework Process Triggered Via Scheduler like Exchange File Download Etc...
                    // Checking Whether CLIENTTZ n CLIENTTZ_OFFSET are Updated in objLogInfo, If not need to update it From Params
                    var clientIP = reqBody.CLIENTIP || params.CLIENTIP;
                    var clientTz = reqBody.CLIENT_TZ || params.CLIENT_TZ;
                    var clientTzOffset = reqBody.CLIENT_TZ_OFFSET || params.CLIENT_TZ_OFFSET;

                    if (!objLogInfo.CLIENTTZ && !objLogInfo.CLIENTTZ_OFFSET) {
                        // reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_LOGINFO_0001', 'There Is No CLIENTIP Found From Headers. Hence Updating From Params', '');
                        reqInstanceHelper.PrintInfo(serviceName, 'CLIENTIP - ' + clientIP, objLogInfo);
                        if (clientIP) {
                            objLogInfo.CLIENTIP = clientIP;
                        }
                    }
                    if (!objLogInfo.CLIENTTZ) {
                        // reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_LOGINFO_0002', 'There Is No CLIENTTZ Found From Headers. Hence Updating From Params', '');
                        reqInstanceHelper.PrintInfo(serviceName, 'CLIENTTZ - ' + clientTz, objLogInfo);
                        objLogInfo.CLIENTTZ = clientTz;
                    }
                    if (!objLogInfo.CLIENTTZ_OFFSET) {
                        // reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_LOGINFO_0003', 'There Is No CLIENTTZ_OFFSET Found From Headers. Hence Updating From Params', '');
                        reqInstanceHelper.PrintInfo(serviceName, 'CLIENTTZ_OFFSET - ' + clientTzOffset, objLogInfo);
                        objLogInfo.CLIENTTZ_OFFSET = clientTzOffset;
                    }

                    objSessionInfo.CLIENTIP = objLogInfo.CLIENTIP;
                    objSessionInfo.CLIENTTZ = objLogInfo.CLIENTTZ;
                    objSessionInfo.CLIENTTZ_OFFSET = objLogInfo.CLIENTTZ_OFFSET;

                    if (sessionValue && sessionValue[0] && sessionValue[0].SELECTED_ROLE) {
                        objSessionInfo.APP_USER_ROLES = sessionValue[0].SELECTED_ROLE;
                    }
                    if (appRequest.body.PROCESS_INFO && typeof (appRequest.body.PROCESS_INFO) == 'string') {
                        appRequest.body.PROCESS_INFO = JSON.parse(appRequest.body.PROCESS_INFO);
                    }
                    objLogInfo.PROCESS_INFO = appRequest.body.PROCESS_INFO ? appRequest.body.PROCESS_INFO : '';
                    objLogInfo.MESSAGE = '';
                    objLogInfo.TENANT_ID = objSessionInfo.TENANT_ID;
                    var arrUrlCode = objLogInfo.SERVICEURL.split('/');
                    if (!objLogInfo.HANDLER_CODE) {
                        objLogInfo.HANDLER_CODE = arrUrlCode[arrUrlCode.length - 1];
                    }
                    if (!objLogInfo.PROCESS) {
                        objLogInfo.PROCESS = arrUrlCode[arrUrlCode.length - 1];
                    }
                    if (!objLogInfo.ACTION) {
                        objLogInfo.ACTION = arrUrlCode[arrUrlCode.length - 1];
                    }
                    objLogInfo.TIMEZONE_INFO = objSessionInfo.TIMEZONE_INFO || {};
                    if (!objLogInfo.CLIENTTZ && objLogInfo.TIMEZONE_INFO) {
                        objLogInfo.CLIENTTZ = objLogInfo.TIMEZONE_INFO.timezone_name;
                    }
                    if (!objLogInfo.CLIENTTZ_OFFSET && objLogInfo.TIMEZONE_INFO) {
                        objLogInfo.CLIENTTZ_OFFSET = objLogInfo.TIMEZONE_INFO.timezone_offset;
                    }
                    reqLogWriter.Eventinsert(objLogInfo);
                    appRequest.headers.LOG_INFO = objLogInfo;
                    return callback(objLogInfo, objSessionInfo);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                return callback(objLogInfo, objSessionInfo);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}


function getConnectionId() {
    try {
        console.log('getConnectionId ' + ConnId);

        if (ConnId == 9999999999) {
            ConnId = 1;
        } else {
            ConnId = ConnId + 1;
        }

        var unqiid = ConnId.toString();
        while (unqiid.length < 10) {
            unqiid = Pad(unqiid);
        }

        function Pad(cnt) {
            cnt = '0' + cnt;
            return cnt;
        }
        console.log('unqiid----' + unqiid);
        return process.pid + unqiid;

    } catch (error) {
        console.log('error in getting connection id for log. ' + error);
    }
}

// Assign Log info params from client params
function AssignLogInfoDetailForCP(pClientParams, pRequest) {
    try {
        var tmplogInfo = {};
        if (pClientParams && pClientParams.LOGINFO) {
            tmplogInfo = JSON.parse(pClientParams.LOGINFO);
        } else {
            tmplogInfo = pClientParams;
        }
        var objLogInfo = {};
        objLogInfo.arrConns = [];
        if (tmplogInfo.APP_DESC != undefined && tmplogInfo.APP_DESC != '')
            objLogInfo.APP_DESC = tmplogInfo.APP_DESC;

        if (tmplogInfo.APP_ID != undefined && tmplogInfo.APP_ID != '')
            objLogInfo.APP_ID = tmplogInfo.APP_ID;

        if (tmplogInfo.LOGIN_NAME != undefined && tmplogInfo.LOGIN_NAME != '')
            objLogInfo.USER_NAME = tmplogInfo.LOGIN_NAME;

        if (tmplogInfo.LOGIN_NAME != undefined && tmplogInfo.LOGIN_NAME != '')
            objLogInfo.LOGIN_NAME = tmplogInfo.LOGIN_NAME;

        if (tmplogInfo.USER_ID != undefined && tmplogInfo.USER_ID != '')
            objLogInfo.USER_ID = tmplogInfo.USER_ID;

        if (tmplogInfo.HANDLER_CODE != undefined && tmplogInfo.HANDLER_CODE != '')
            objLogInfo.HANDLER_CODE = tmplogInfo.HANDLER_CODE;

        if (tmplogInfo.MENU_ITEM_DESC != undefined && tmplogInfo.MENU_ITEM_DESC != '')
            objLogInfo.PROCESS = tmplogInfo.MENU_ITEM_DESC;

        if (tmplogInfo.ACTION_DESC != undefined && tmplogInfo.ACTION_DESC != '')
            objLogInfo.ACTION = tmplogInfo.ACTION_DESC;

        if (tmplogInfo.SYSTEM_ID != undefined && tmplogInfo.SYSTEM_ID != '')
            objLogInfo.SYSTEM_ID = tmplogInfo.SYSTEM_ID;

        if (tmplogInfo.SYSTEM_DESC != undefined && tmplogInfo.SYSTEM_DESC != '')
            objLogInfo.SYSTEM_DESC = tmplogInfo.SYSTEM_DESC;

        if (tmplogInfo.SESSION_ID != undefined && tmplogInfo.SESSION_ID != '')
            objLogInfo.SESSION_ID = tmplogInfo.SESSION_ID;

        if (tmplogInfo.PRCT_ID != undefined && tmplogInfo.PRCT_ID != '')
            objLogInfo.PRCT_ID = tmplogInfo.PRCT_ID;
        else
            objLogInfo.PRCT_ID = reqUuid.v1();

        if (pRequest.headers.referer != undefined && pRequest.headers.referer != '')
            objLogInfo.CLIENTURL = pRequest.headers.referer;
        else
            objLogInfo.CLIENTURL = "";
        objLogInfo.SERVICEURL = (pRequest.headers.host && pRequest.originalUrl && pRequest.headers.host + pRequest.originalUrl.toString()) || '';
        objLogInfo.NEED_INSERT = 'N';
        objLogInfo.headers = pRequest.headers;
        objLogInfo.MESSAGE = '';
        objLogInfo.arrMessage = [];
        return objLogInfo;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-LOGINFO-0001', 'Catch Error in AssignLogInfoDetailForCP()...', error);
        return objLogInfo;

    }
}


// Export public properties
module.exports = {
    LogInfo: LogInfo,
    AssignLogInfoDetail: assignLogInfoDetail,
    AssignLogInfoDetailForCP: AssignLogInfoDetailForCP
};
/********* End of File *************/