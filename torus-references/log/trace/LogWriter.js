/**
 @Decsription : Logwriter for producing messages to kafka or solr 
 */

// Require dependencies
var reqProducer = require('../../common/Producer');
var reqDateFormatter = require('../../common/dateconverter/DateFormatter');
var reqTranDBInstance = require('../../instance/TranDBInstance');
var reqMoment = require('moment');
var reqMomentTimezone = require('moment-timezone');
var reqPath = require('path');
var reqOs = require('os');
var LogDBConn = ""
var containerName = reqOs.hostname();

// Assign Start time value
function Insert(pLogInfo) {
    var headers = {};
    if (pLogInfo && pLogInfo.headers) {
        headers = pLogInfo.headers;
    }
    if (pLogInfo.BGPROCESS_FILEPATH) {
        pLogInfo.STARTTIME = new Date().toISOString();
    } else {
        pLogInfo.STARTTIME = reqDateFormatter.GetTenantCurrentDateTime(headers, pLogInfo, 'YYYY-MM-DD HH:mm:ss.SSSS');
        // pLogInfo.STARTTIME = reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
    }
    pLogInfo.MESSAGE = '';
}

function formatMessage(pMessage, pMsg, pPrctId, pServiceName, pHandlerCode) {
    if (pMessage) {
        pMessage = pMessage + '\r\n';
    }
    pMessage = pMessage + containerName + ' \t';
    pMessage = pMessage + reqMoment(new Date()).format('YYYY-MM-DD hh:mm:ss A') + ' \t';
    pMessage = pMessage + pHandlerCode + '\t';
    // pMessage = pMessage + pHandlerCode + ' ' + '\t';
    // pMessage = pMessage + '\t\t' + containerName + '\t\t';
    pMessage = pMessage + pServiceName;
    pMessage = pMessage + 'CON\\' + pPrctId;
    pMessage = pMessage + ' >> ';
    pMessage = pMessage + pMsg;
    return pMessage;
}

// Update to event log
function update(pLogInfo) {
    var headers = {};
    if (pLogInfo) {
        headers = pLogInfo.headers ? pLogInfo.headers : {};
    } else {
        pLogInfo = {};
    }
    //Kafka producer
    if (pLogInfo.MESSAGE) {
        if (pLogInfo.LOGTYPE != 'ERR') {
            pLogInfo.LOGTYPE = 'INFO';
            pLogInfo.IS_INFO = 'Y';
            pLogInfo.IS_EVENT = 'N';
            pLogInfo.ISERROR = 'N';
        }
        if (pLogInfo.BGPROCESS_FILEPATH) {
            pLogInfo.ENDTIME = new Date().toISOString();
        } else {
            pLogInfo.ENDTIME = reqDateFormatter.GetTenantCurrentDateTime(headers, pLogInfo, 'YYYY-MM-DD HH:mm:ss.SSSS');
            // pLogInfo.ENDTIME = reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
        }
        if (pLogInfo.PROCESS_INFO) {
            // var menuitem = pLogInfo.PROCESS_INFO.MENU_ITEM;
            pLogInfo.PROCESS = pLogInfo.PROCESS_INFO.MENU_ITEM ? pLogInfo.PROCESS_INFO.MENU_ITEM : pLogInfo.PROCESS;  //pLogInfo.PROCESS_INFO.MENU_ITEM;
            pLogInfo.HANDLER_CODE = pLogInfo.PROCESS_INFO.HANDLER_CODE ? pLogInfo.PROCESS_INFO.HANDLER_CODE : pLogInfo.HANDLER_CODE;
        }
        DeleteLogInfoFrmHeaders(pLogInfo);
        var tmpLogInfo = JSON.stringify(ConvertIntoString(pLogInfo));

        // if (LogDBConn) {
        //     _insertTraceLog(pLogInfo)
        // } else {
        //     _getLogDbConnection(headers, function () {
        //         _insertTraceLog(pLogInfo)

        //     })
        // }


        // produce the log into kafka
        reqProducer.ProduceMessage('TRACE_LOG', tmpLogInfo, headers, function (result) {
            if (result) {
                if (global.globalLog) {
                    global.globalLog.del(pLogInfo.PRCT_ID);
                }
                pLogInfo.MESSAGE = null;
                tmpLogInfo = null;
            }
        });

    }

}

// Get Db Connection to insert the log info
// function _getLogDbConnection(pHeaders, pcallback) {
//     try {
//         reqTranDBInstance.GetTranDBConn(pHeaders, false, function (connection) {
//             LogDBConn = connection
//             pcallback()
//         })
//     } catch (error) {

//     }
// }

function _insertTraceLog(InsertRow) {
    try {
        var Headers = InsertRow.headers;
        delete InsertRow.headers;
        delete InsertRow.arrConns;
        delete InsertRow.PARENT_SYS_TYPE_FOR_ROUTING;
        delete InsertRow.EXT_AUTH_TOKEN_BLOCKCHAIN;
        delete InsertRow.ATMPTCOUNT;
        delete InsertRow.atmptCount;

        InsertRow.PROCESS_INFO = JSON.stringify(InsertRow.PROCESS_INFO);
        InsertRow.TIMEZONE_INFO = JSON.stringify(InsertRow.TIMEZONE_INFO);
        InsertRow.ENDTIME = reqDateFormatter.GetDateTimeWithTenantTZ(Headers, {}, InsertRow.ENDTIME);
        InsertRow.STARTTIME = reqDateFormatter.GetDateTimeWithTenantTZ(Headers, {}, InsertRow.STARTTIME);
        reqTranDBInstance.InsertTranDB(LogDBConn, "TRACE_LOG", [InsertRow], {}, function (pResult, pError) {
            try {
                if (pError) {
                    console.log(pError)
                } else {

                }

            } catch (error) {
                console.log(error)
            }
        })
    } catch (error) {
        console.log(error)
    }
}
// Append trace info to existing info in this log
function TraceInfo(pLogInfo, pMessage) {
    if (pLogInfo) {
        if (pLogInfo.LOGTYPE != 'ERR') {
            pLogInfo.LOGTYPE = 'INFO';
            pLogInfo.IS_INFO = 'Y';
            pLogInfo.IS_EVENT = 'N';
            pLogInfo.ISERROR = 'N';
        }
        if (!pLogInfo.MESSAGE) {
            pLogInfo.MESSAGE = '';
        }
        pLogInfo.MESSAGE = formatMessage(pLogInfo.MESSAGE, trimLogMessage(pMessage), pLogInfo.PRCT_ID, pLogInfo.SERVICE_NAME, pLogInfo.HANDLER_CODE);
        pLogInfo.HOST_NAME = containerName;
        if (!global.physicalLogInfo) {
            global.physicalLogInfo = [];
        }
        // for log file write 
        if (pLogInfo.MESSAGE) {
            global.physicalLogInfo.push(formatMessage('', trimLogMessage(pMessage), pLogInfo.PRCT_ID, pLogInfo.SERVICE_NAME, pLogInfo.HANDLER_CODE));
        }
    }
}

function trimLogMessage(pMsg) {
    if (pMsg.length > 1000) {
        return pMsg.substring(0, 1000) + '...';
    }
    return pMsg;
}

// Produce trace warning message to kafka
function TraceWarning(pLogInfo, pMessage) {
    var headers = {};
    if (pLogInfo) {
        headers = pLogInfo.headers ? pLogInfo.headers : {};
    } else {
        pLogInfo = {};
    }
    //Kafka producer
    pLogInfo.LOGTYPE = 'WARN';
    pLogInfo.MESSAGE = formatMessage(pLogInfo.MESSAGE, pMessage, pLogInfo.PRCT_ID, pLogInfo.SERVICE_NAME, pLogInfo.HANDLER_CODE);
    if (pLogInfo.BGPROCESS_FILEPATH) {
        pLogInfo.ENDTIME = new Date().toISOString();
    } else {
        pLogInfo.ENDTIME = reqDateFormatter.GetTenantCurrentDateTime(headers, pLogInfo, 'YYYY-MM-DD HH:mm:ss.SSSS');
        // pLogInfo.ENDTIME = reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
    }
    DeleteLogInfoFrmHeaders(pLogInfo);
    var tmpLogInfo = JSON.stringify(ConvertIntoString(pLogInfo));
    reqProducer.ProduceMessage('TRACE_LOG', tmpLogInfo, headers, function () {
        //console.log('Trace WARN Inserted');
    });
}

// Produce trace error message to kafka
function TraceError(pLogInfo, pMessage, pErrorCode) {
    pLogInfo.MESSAGE = formatMessage(pLogInfo.MESSAGE, pMessage, pLogInfo.PRCT_ID, pLogInfo.SERVICE_NAME, pLogInfo.HANDLER_CODE);
    pLogInfo.HOST_NAME = containerName;
    //Kafka producer
    Doinsertkafka(pLogInfo, 'ERR', pMessage, pErrorCode);
    // for log file write 
    if (pLogInfo.MESSAGE) {
        global.physicalLogInfo.push(formatMessage('', pMessage, pLogInfo.PRCT_ID, pLogInfo.SERVICE_NAME, pLogInfo.HANDLER_CODE));
    }
}

// Function for insert kafka 
function Doinsertkafka(pLogInfo, type, pMessage, pErrorCode) {
    var headers = {};
    if (pLogInfo) {
        headers = pLogInfo.headers ? pLogInfo.headers : {};
    } else {
        pLogInfo = {};
    }
    pLogInfo.LOGTYPE = type;
    pLogInfo.ERROR_CODE = pErrorCode;
    pLogInfo.ISERROR = 'Y';
    pLogInfo.IS_INFO = 'N';
    pLogInfo.IS_EVENT = 'N';
    pLogInfo.MESSAGE = formatMessage(pLogInfo.MESSAGE, pMessage, pLogInfo.PRCT_ID, pLogInfo.SERVICE_NAME, pLogInfo.HANDLER_CODE);
    if (pLogInfo.BGPROCESS_FILEPATH) {
        pLogInfo.ENDTIME = new Date().toISOString();
    } else {
        pLogInfo.ENDTIME = reqDateFormatter.GetTenantCurrentDateTime(headers, pLogInfo, 'YYYY-MM-DD HH:mm:ss.SSSS');
        // pLogInfo.ENDTIME = reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
    }
    DeleteLogInfoFrmHeaders(pLogInfo);
    var tmpLogInfo = JSON.stringify(ConvertIntoString(pLogInfo));
    reqProducer.ProduceMessage('TRACE_LOG', tmpLogInfo, headers, function (result) {
        if (result) {
            pLogInfo.MESSAGE = '';
            UpdateToEventLog(pLogInfo);
        }
    });
}

// Produce kafka message for update event log with end time
function UpdateToEventLog(pLogInfo) {
    var headers = {};
    if (pLogInfo) {
        headers = pLogInfo.headers ? pLogInfo.headers : {};
    } else {
        pLogInfo = {};
    }
    //Kafka producer
    pLogInfo.LOGTYPE = 'EVENT';
    pLogInfo.ERROR_CODE = '';
    pLogInfo.IS_EVENT = 'Y';
    if (pLogInfo.BGPROCESS_FILEPATH) {
        pLogInfo.ENDTIME = new Date().toISOString();
    } else {
        pLogInfo.ENDTIME = reqDateFormatter.GetTenantCurrentDateTime(headers, pLogInfo, 'YYYY-MM-DD HH:mm:ss.SSSS');
        // pLogInfo.ENDTIME = reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
    }
    DeleteLogInfoFrmHeaders(pLogInfo);
    var tmpLogInfo = JSON.stringify(ConvertIntoString(pLogInfo));
    reqProducer.ProduceMessage('TRACE_LOG', tmpLogInfo, headers, function (result) {
        pLogInfo = null;
        tmpLogInfo = null;
        headers = null;
        //  console.log('Event Log Inseted');
    });
}

// GetLogInfo for Log Writing 
// Only Used in Torus Bg Processes
function GetLogInfo(handlerCode, process, action, path) {
    var prct_id = (Date.now() / 100000000000).toString().split('.')[1].substring(0, 10);
    var logInfo = {
        "POOL": {
            "min": 0,
            "max": 7
            , "idleTimeoutMillis": 10000
        },
        "APP_DESC": 'TORUS_APP',
        "APP_ID": 1,
        "APP_CODE": '001',
        "APPSTS_ID": 'APP001',
        "LOGIN_NAME": 'TORUS_USER',
        "TENANT_ID": '0',
        "NEED_SOLR_LOG": false,
        "USER_ID": 'USR00001',
        "SYSTEM_ID": 'S_TORUS_SYSTEM',
        "SYSTEM_DESC": 'TORUS_SYSTEM',
        "SERVICEURL": '-',
        "CLIENTURL": '-',
        "PRCT_ID": prct_id,
        "HANDLER_CODE": handlerCode,
        "PROCESS": process,
        "ACTION": action,
        "NEED_INSERT": 'N',
        "MESSAGE": '',
        "STARTTIME": new Date().toISOString(),
        // "STARTTIME": reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS'),
        "BGPROCESS_FILEPATH": path,
        // Updating All the Information into objLogInfo
        "CLIENTIP": '127.0.0.1',
        "CLIENTTZ": reqMomentTimezone.tz.guess(),
        "CLIENTTZ_OFFSET": new Date().getTimezoneOffset()
        // "TIMEZONE_INFO": { "utc_mode": "true", "timezone_name": "Africa/Nairobi", "timezone_offset": "-180", "user_time_zone": "false" } // @@
    };


    if (!global.physicalLogInfo) {
        global.physicalLogInfo = [];
    }
    global.serviceLogPath = global.serviceLogPath = reqPath.join(__dirname, '../../../torus-services/' + path + '/logs/');
    return logInfo;
}

// To Delete ObjLogInfo from Headers Property
function DeleteLogInfoFrmHeaders(pLogInfo) {
    if (pLogInfo && pLogInfo.headers && pLogInfo.headers.LOG_INFO) {
        delete pLogInfo.headers.LOG_INFO;
    }
}


// To Stringify All the Object Type Values used in the Objloginfo
function ConvertIntoString(pLogInfo) {
    try {
        if (pLogInfo) {
            var newObjLogInfo = {};
            for (const key in pLogInfo) {
                var element = pLogInfo[key];
                if (typeof element == 'object') {
                    element = JSON.stringify(element);
                }
                newObjLogInfo[key] = element;
            }
            return newObjLogInfo;
        }
    } catch (error) {
        console.log('Catch Error', error);
    }
}


// Export public properties and functions
module.exports = {
    TraceInfo: TraceInfo,
    TraceWarning: TraceWarning,
    TraceError: TraceError,
    Eventinsert: Insert,
    EventUpdate: update,
    GetLogInfo: GetLogInfo,
    DeleteLogInfoFrmHeaders: DeleteLogInfoFrmHeaders
};
/********* End of File *************/