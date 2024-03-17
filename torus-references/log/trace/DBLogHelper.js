/**
 @Decsription      : DB helper for logging 
 */

// Require dependencies
var reqInstanceHelper = require('../../common/InstanceHelper');
var reqDateFormatter = require('../../common/dateconverter/DateFormatter');
var serviceName = 'DBLogHelper';

// Insert log to DB 
function insertToDatabase(pData, callback) {
    var reqDBInstance = require('../../instance/DBInstance');
    //var reqTranDBInstance = require('../helper/TranDBInstance');
    //reqTranDBInstance.GetFXTranDBConn(pData.headers, 'log_cas', false, function (pClient) {
    reqDBInstance.GetFXDBConnection(pData.headers, 'log_cas', false, function (pClient) {
        try {
            pClient.DbType = 'SQLDB';
            if (pData.LOGTYPE == 'EVENT' && pData.IS_EVENT == 'Y') {
                reqDBInstance.InsertFXDB(pClient, 'EVENT_LOG', [{
                    PRCT_ID: pData.PRCT_ID ? pData.PRCT_ID : '',
                    APP_DESC: pData.APP_DESC ? pData.APP_DESC : '',
                    APP_ID: pData.APP_ID ? pData.APP_ID : '',
                    CLIENTURL: pData.CLIENTURL ? pData.CLIENTURL : '',
                    HANDLER_CODE: pData.HANDLER_CODE ? pData.HANDLER_CODE : '',
                    SERVICEURL: pData.SERVICEURL ? pData.SERVICEURL : '',
                    SESSION_ID: pData.SESSION_ID ? pData.SESSION_ID : '',
                    STARTTIME: pData.STARTTIME ? reqDateFormatter.ConvertDate(pData.STARTTIME.toLocaleString(), pData.headers) : null,
                    SYSTEM_DESC: pData.SYSTEM_DESC ? pData.SYSTEM_DESC : '',
                    SYSTEM_ID: pData.SYSTEM_ID ? pData.SYSTEM_ID : '',
                    USER_ID: pData.USER_ID ? pData.USER_ID : '',
                    USER_NAME: pData.USER_NAME ? pData.USER_NAME : '',
                    PROCESS: pData.MENU_ITEM_DESC ? pData.MENU_ITEM_DESC : '',
                    ACTION: pData.ACTION_DESC ? pData.ACTION_DESC : '',
                    ENDTIME: new Date()
                }], null, function (pError,pResult) {
                    var result = 'SUCCESS';
                    if (pError) {
                        console.log('Error ' + pError.stack);
                        result = 'FAILURE';
                    }
                    if (callback) {
                        return callback(result);
                    }
                });
            } else if ((pData.LOGTYPE == 'INFO' && pData.IS_INFO == 'Y') || (pData.LOGTYPE == 'ERR' && pData.ISERROR == 'Y')) {
                // if (pData.LOGTYPE == 'EVENT') {
                //     pData.LOGTYPE = 'INFO';
                // }
                //var b = new Buffer(pData.MESSAGE, 'base64');
                //pData.MESSAGE = b.toString();
                reqDBInstance.InsertFXDB(pClient, 'TRACE_LOG', [{
                    T_ID: reqInstanceHelper.Guid(),
                    ACTION: pData.ACTION ? pData.ACTION : '',
                    DATETIME: new Date(),
                    ERROR_CODE: pData.ERROR_CODE ? pData.ERROR_CODE : '',
                    LOGTYPE: pData.LOGTYPE ? pData.LOGTYPE : '',
                    MESSAGE: pData.MESSAGE ? pData.MESSAGE : '',
                    PARENT_PROCESS: pData.PARENT_PROCESS ? pData.PARENT_PROCESS : '',
                    PRCT_ID: pData.PRCT_ID ? pData.PRCT_ID : '',
                    PROCESS: pData.PROCESS ? pData.PROCESS : '',
                    SERVICEURL: pData.SERVICEURL ? pData.SERVICEURL : '',
                    IS_INDEXED: 'N',
                    EVENT_TYPE: 'TRACE',
                    APP_DESC: pData.APP_DESC ? pData.APP_DESC : '',
                    APP_ID: pData.APP_ID ? pData.APP_ID : '',
                    CLIENTURL: pData.CLIENTURL ? pData.CLIENTURL : '',
                    HANDLER_CODE: pData.HANDLER_CODE ? pData.HANDLER_CODE : '',
                    SESSION_ID: pData.SESSION_ID ? pData.SESSION_ID : '',
                    STARTTIME: pData.STARTTIME ? reqDateFormatter.ConvertDate(pData.STARTTIME.toLocaleString(), pData.headers) : null,
                    SYSTEM_DESC: pData.SYSTEM_DESC ? pData.SYSTEM_DESC : '',
                    SYSTEM_ID: pData.SYSTEM_ID ? pData.SYSTEM_ID : '',
                    USER_ID: pData.USER_ID ? pData.USER_ID : '',
                    USER_NAME: pData.USER_NAME ? pData.USER_NAME : '',
                    ENDTIME: new Date()
                }], null, function (pError,pResult) {
                    var result = 'SUCCESS';
                    if (pError) {
                        console.log('Error ' + pError.stack);
                        result = 'FAILURE';
                    }
                    if (callback) {
                        return callback(result);
                    }
                });
            }
        } catch (error) {
            console.log(error.stack);
        }
    });
}

module.exports = {
    InsertToDatabase: insertToDatabase
}
/********* End of File *************/