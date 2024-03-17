/**
 @Decsription : Solr helper file to insert log data solr LOG_CORE 
 */

// Require dependencies
var reqSolrInstance = require('../../instance/SolrInstance');
var reqInstanceHelper = require('../../common/InstanceHelper');
var reqDBInstance = require('../../instance/DBInstance');
var reqDateFormatter = require('../../common/dateconverter/DateFormatter')
var reqTranDBHelper = require('../../instance/TranDBInstance');
var Replace = require('replaceall');
var fs = require('fs');

// Log Cassandra Initialization
var mLogClient = {};
var solrClient;
var serviceName = 'SolrLogHelper';

//function for solr Entry
function _WriteLoggingError(pMessage) {
    try {
        console.log(pMessage);
    } catch (ex) {
        console.log('write log file error ' + ex.stack);
    }
}

// Not used since autocommit enabled
function commitSolr() {
    if (solrClient) {
        //solrClient.commit();
    }
}


//kafka consumer start
function SaveLogToSolr(strMsg, callback) {
    try {
        //console.log(strMsg);
        var mHeaders = strMsg.headers;
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var LogCore = 'TRACE_LOG_CORE';
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            LogCore = 'DEBUG_LOG';
        }
        reqSolrInstance.GetSolrLogConn(mHeaders, LogCore, function (pSolrClient) {
            solrClient = pSolrClient;
            if (solrClient) {
                writeData(strMsg, 'solr', function callbackWriteToSolr(pStatus) {
                    try {
                        if (pStatus) {
                            return callback('SUCCESS');
                        } else {
                            return callback('FAILURE');
                        }
                    } catch (ex) {
                        _WriteLoggingError(ex.stack);
                    }
                });
            }
        });
    } catch (ex) {
        _WriteLoggingError('Error on Log consumer start - ' + ex.stack);
    }
}






// to write a log into physical file from global memory
var filelogwrite = function () {
    try {
        // Getting Physical Log Parameters From Redis Service Param Config
        reqInstanceHelper.GetRedisServiceParamConfig(null, function (error, result) {
            try {
                if (error) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Redis Service Param Config', null);
                } else {
                    if (result) {
                        result = JSON.parse(result);
                        if ('LOG_FILE_ROTATION_COUNT' in result) {
                            if (result.LOG_FILE_ROTATION_COUNT) {
                                maxFilesCount = result.LOG_FILE_ROTATION_COUNT;
                            }
                        }
                        if ('LOG_FILE_MAXIMUM_SIZE_MB' in result) {
                            if (result.LOG_FILE_MAXIMUM_SIZE_MB) {
                                maxFileSize = (1024 * 1024 * result.LOG_FILE_MAXIMUM_SIZE_MB); // Converting Into Bytes
                            }
                        }
                    }
                }
            } catch (error) {
                _WriteLoggingError('Catch Error - ' + error.stack);
            }
            setInterval(() => {
                var curlogLength = global.physicalLogInfo.length;
                if (curlogLength > 0) {
                    var message = '';
                    for (var i = 0; i < curlogLength; i++) {
                        if (message) {
                            message = message + global.physicalLogInfo[i] + '\r\n';
                        } else {
                            message = global.physicalLogInfo[i] + '\r\n';
                        }
                    }
                    writeOnphysicalFile(message, curlogLength, global.serviceLogPath);
                }
            }, 3000);
        });
    } catch (ex) {
        _WriteLoggingError('Error on Log consumer start - ' + ex.stack);
    }
};

function SaveLogToFile(strMsg, callback) {
    try {
        writeData(strMsg, 'file', function callbackWriteToSolr(pStatus) {
            try {
                if (pStatus) {
                    return callback('SUCCESS');
                } else {
                    return callback('FAILURE');
                }
            } catch (ex) {
                _WriteLoggingError(ex.stack);
            }
        });
    } catch (ex) {
        _WriteLoggingError('Error on Log consumer start - ' + ex.stack);
    }
}

// replace special characters in message content before insert to solr
function writeData(pMessage, to, pCallback) {
    try {
        var strMessage = pMessage;
        if (typeof (strMessage.MESSAGE) === 'string' && strMessage.MESSAGE != "") {
            if (strMessage.MESSAGE != '') {
                // strMessage.MESSAGE = Replace("<", "&lt;", strMessage.MESSAGE);
                // strMessage.MESSAGE = Replace("<", "&lt;", strMessage.MESSAGE);
                // var byts = strMessage.MESSAGE;
                // var b = new Buffer.from(byts);
                // strMessage.MESSAGE = b.toString('base64');
            }
        } else {
            if (strMessage.MESSAGE['message']) {
                strMessage.MESSAGE = strMessage.MESSAGE.message;
                strMessage.MESSAGE = Replace("<", "&lt;", strMessage.MESSAGE);
                strMessage.MESSAGE = Replace("<", "&lt;", strMessage.MESSAGE);
                var byts = strMessage.MESSAGE;
                var b = new Buffer.from(byts);
                strMessage.MESSAGE = b.toString('base64');
            }
        }
        switch (to) {
            case 'cassandra':
                if (strMessage.LOGTYPE == 'EVENT' && strMessage.IS_EVENT == 'Y') {
                    _WriteEventToCassandra(pMessage, pCallback);
                } else if ((strMessage.LOGTYPE == 'INFO' && strMessage.IS_INFO == 'Y') || (strMessage.LOGTYPE == 'ERR' && strMessage.ISERROR == 'Y')) {
                    if (strMessage.LOGTYPE == 'EVENT') {
                        strMessage.LOGTYPE = 'INFO';
                    }
                    try {
                        var b = new Buffer.from(pMessage.MESSAGE, 'base64');
                        pMessage.MESSAGE = b.toString();

                        var mHeaders = JSON.parse(pMessage.headers);
                        var Currentroutingkey = mHeaders.routingkey;
                        // check the connection available
                        if (mLogClient[Currentroutingkey]) {
                            // callwriteData(strMsg)
                            _WriteToDB(pMessage, mLogClient[Currentroutingkey],Currentroutingkey, pCallback);
                        } else {
                            // if not get the connection set into memory along with routingkey
                            reqDBInstance.GetFXDBConnection(mHeaders, 'log_cas', {}, function CallbackGetCassandraConn(pLogClient) {
                                // reqTranDBHelper.GetTranDBConn(mHeaders, false, function (pLogClient) {
                                try {
                                    mLogClient[Currentroutingkey] = pLogClient;
                                    // callwriteData(strMsg)
                                    _WriteToDB(pMessage, pLogClient,Currentroutingkey, pCallback);
                                } catch (error) {

                                }
                            });
                        }
                    } catch (ex) {
                        _WriteLoggingError(ex.stack);
                    }
                }
                break;
            case 'solr':
                if ((strMessage.LOGTYPE == 'INFO' && strMessage.IS_INFO == 'Y') || (strMessage.LOGTYPE == 'ERR' && strMessage.ISERROR == 'Y')) {
                    if (strMessage.LOGTYPE == 'EVENT') {
                        strMessage.LOGTYPE = 'INFO';
                    }
                    _WriteOnSolr(strMessage, pCallback);
                    //writeOnFile(strMessage); //this is for always write latest server log in file
                } else {
                    console.log('Solr Entry Not Done');
                }
                break;
            case 'file':
                if ((strMessage.LOGTYPE == 'INFO' && strMessage.IS_INFO == 'Y') || (strMessage.LOGTYPE == 'ERR' && strMessage.ISERROR == 'Y')) {
                    if (strMessage.LOGTYPE == 'EVENT') {
                        strMessage.LOGTYPE = 'INFO';
                    }
                    writeOnFile(strMessage);
                    return pCallback('SUCCESS');
                }
                break;
        }
    } catch (ex) {
        _WriteLoggingError(ex.stack);
    }
}

var pPath = "";
var maxFileSize = 1024 * 1024 * 5; //5mb
var maxFilesCount = 20; //max files count on logs path
var fileName = 'ServerTraceLog_';
var fileExt = '.log';
var pattern = /(^[Ss][Ee][Rr][Vv][Ee][Rr][Tt][Rr][Aa][Cc][Ee][Ll][Oo][Gg][_][\d]{1,}[.][l][o][g]$)/; // Need to Change the Pattern Here, If any changes made in File Name...

function writeOnFile(pLogInfo) {
    try {
        /* var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (!logFilePath || serviceModel.TYPE != 'LITE') { */
        if (pLogInfo.BGPROCESS_FILEPATH) {
            pPath = fs.realpathSync(__dirname + '../../../../torus-services/' + pLogInfo.BGPROCESS_FILEPATH);
            if (pLogInfo.FTP_ERROR) {
                pPath = pPath + '/ftp_error';
            }
            else if (pLogInfo.DATABASE_ERROR) {
                pPath = pPath + '/database_error';
            }
            else {
                pPath = pPath + '/logs';
            }
        }
        else {
            var arrServieceUrl = pLogInfo.SERVICEURL.split('/');
            var servieceName = arrServieceUrl[1].toLowerCase() == 'nodescan' ? 'scan' : arrServieceUrl[1].toLowerCase();
            pPath = fs.realpathSync(__dirname + '../../../../torus-services/api/' + servieceName) + '/logs';
        }
        // }

        var arrLogMsg = pLogInfo.arrMessage;
        // writedata(arrLogMsg.shift());

        function writedata(msg) {
            // var data = new Buffer(pLogInfo.MESSAGE, 'base64').toString();
            var data = msg;
            if (pPath) {
                var exists = fs.existsSync(pPath);
                try {
                    if (!exists) {
                        fs.mkdirSync(pPath);
                    }
                    // console.log('logFilePath : ' + logFilePath);
                    var files = fs.readdirSync(pPath);
                    var filtered_files = [];
                    var regexFileNamePattern = new RegExp(pattern);
                    for (var a = 0; a < files.length; a++) {
                        if (regexFileNamePattern.test(files[a])) {
                            filtered_files.push(files[a]);
                        }
                    }
                    files = filtered_files;
                    files.sort(function (a, b) {
                        return (a.match(/(\d+)/g)[0]) - ((b.match(/(\d+)/g)[0]));
                    });
                    try {
                        var filesCount = files.length;
                        var fileVer = 1;
                        var currentFile = fileName + fileVer + fileExt;
                        var nextFile = fileName + (fileVer + 1) + fileExt;
                        if (filesCount) {
                            var prevModified = '';
                            for (var i = 1; i <= filesCount; i++) { //set version by last modified
                                var currentFileName = files[i - 1];
                                var currentFileStat = fs.statSync(pPath + '/' + currentFileName);
                                if (prevModified) {
                                    var prevFileStat = fs.statSync(pPath + '/' + prevModified);
                                    if ((prevFileStat['mtime']).valueOf() < (currentFileStat['mtime']).valueOf()) {
                                        fileVer = i;
                                    }
                                } else {
                                    prevModified = currentFileName;
                                    fileVer = i;
                                }
                            }
                        }
                        // console.log('filesCount : ' + filesCount);
                        // console.log('fileVer : ' + fileVer);
                        currentFile = fileName + fileVer + fileExt;
                        if (fileVer >= maxFilesCount) {
                            nextFile = fileName + 1 + fileExt;
                        } else {
                            nextFile = fileName + (fileVer + 1) + fileExt;
                        }
                        if (fs.existsSync(pPath + '/' + currentFile)) {
                            var currentFileStat = fs.statSync(pPath + '/' + currentFile);
                            var currentFileSize = currentFileStat["size"];
                            var result = fs.readFileSync(pPath + '/' + currentFile);
                            doWrite(result.toString());
                        } else {
                            doWrite();
                        }
                        function doWrite(result) {
                            if (result) {
                                data = result + '\n' + data;
                            }
                            var byteData = new Buffer(data);
                            console.log('current : ' + currentFile);
                            console.log('next : ' + nextFile);
                            if (currentFileSize > maxFileSize) {
                                var data1 = byteData.toString('ascii', 0, currentFileSize);
                                var data2 = byteData.toString('ascii', currentFileSize);
                                fs.writeFileSync(pPath + '/' + currentFile, data1);
                                if (fs.existsSync(pPath + '/' + nextFile)) {
                                    fs.unlinkSync(pPath + '/' + nextFile);
                                    console.log('delete called : ' + pPath + '/' + nextFile);
                                }
                                fs.writeFileSync(pPath + '/' + nextFile, data2);
                            } else {
                                fs.writeFileSync(pPath + '/' + currentFile, data);
                            }
                            // if (arrLogMsg.length) {
                            //     writedata(arrLogMsg.shift());
                            // }
                        }
                    } catch (error) {
                        console.log(error);
                    }
                } catch (error) {
                    console.log(error);
                }
            } else {
                console.log('logs directory not found');
            }
        }
    } catch (error) {
        console.log(error);
    }
}


function writeOnphysicalFile(pMsg, pLoglength, pPath) {
    try {
        // maxFileSize = 1024 * 10;
        // maxFilesCount = 5
        if (pPath) {
            var exists = fs.existsSync(pPath);
            try {
                if (!exists) {
                    fs.mkdirSync(pPath);
                }
                // console.log('logFilePath : ' + logFilePath);
                var files = fs.readdirSync(pPath);
                var filtered_files = [];
                var regexFileNamePattern = new RegExp(pattern);
                for (var a = 0; a < files.length; a++) {
                    if (regexFileNamePattern.test(files[a])) {
                        filtered_files.push(files[a]);
                    }
                }
                files = filtered_files;
                files.sort(function (a, b) {
                    return (a.match(/(\d+)/g)[0]) - ((b.match(/(\d+)/g)[0]));
                });
                try {
                    var filesCount = files.length;
                    var fileVer = 1;
                    var currentFile = fileName + fileVer + fileExt;
                    var nextFile = fileName + (fileVer + 1) + fileExt;
                    if (filesCount) {
                        var prevModified = '';
                        for (var i = 1; i <= filesCount; i++) { //set version by last modified
                            var currentFileName = files[i - 1];
                            var currentFileStat = fs.statSync(pPath + '/' + currentFileName);
                            if (prevModified) {
                                var prevFileStat = fs.statSync(pPath + '/' + prevModified);
                                if ((prevFileStat['mtime']).valueOf() < (currentFileStat['mtime']).valueOf()) {
                                    fileVer = i;
                                }
                            } else {
                                prevModified = currentFileName;
                                fileVer = i;
                            }
                        }
                    }
                    // console.log('filesCount : ' + filesCount);
                    // console.log('fileVer : ' + fileVer);
                    currentFile = fileName + fileVer + fileExt;
                    if (fileVer >= maxFilesCount) {
                        nextFile = fileName + 1 + fileExt;
                    } else {
                        nextFile = fileName + (fileVer + 1) + fileExt;
                    }
                    if (fs.existsSync(pPath + '/' + currentFile)) {
                        var currentFileStat = fs.statSync(pPath + '/' + currentFile);
                        var currentFileSize = currentFileStat["size"];
                        var result = fs.readFileSync(pPath + '/' + currentFile);
                        doWrite(result.toString());
                    } else {
                        doWrite();
                    }
                    function doWrite(result) {
                        if (result) {
                            pMsg = result + pMsg;
                        }
                        var byteData = new Buffer.from(pMsg);
                        console.log('current : ' + currentFile);
                        console.log('next : ' + nextFile);
                        if (currentFileSize > maxFileSize) {
                            var data1 = byteData.toString('ascii', 0, currentFileSize);
                            var data2 = byteData.toString('ascii', currentFileSize);
                            fs.writeFileSync(pPath + '/' + currentFile, data1);
                            if (fs.existsSync(pPath + '/' + nextFile)) {
                                fs.unlinkSync(pPath + '/' + nextFile);
                                console.log('delete called : ' + pPath + '/' + nextFile);
                            }
                            fs.writeFileSync(pPath + '/' + nextFile, data2);
                            global.physicalLogInfo.splice(0, pLoglength);
                        } else {
                            fs.writeFileSync(pPath + '/' + currentFile, pMsg);
                            global.physicalLogInfo.splice(0, pLoglength);
                        }
                        pMsg = null;
                        data1 = null;
                        data2 = null;
                        byteData = null;
                        result = null;
                    }
                } catch (error) {
                    global.physicalLogInfo.splice(0, pLoglength);
                    console.log(error);
                }
            } catch (error) {
                global.physicalLogInfo.splice(0, pLoglength);
                console.log(error);
            }
        } else {
            global.physicalLogInfo.splice(0, pLoglength);
            console.log('logs directory not found');
        }

    } catch (error) {
        global.physicalLogInfo.splice(0, pLoglength);
        console.log(error);
    }
}





// Write log data to solr
function _WriteOnSolr(pTraceLogInfo, pCallback) {
    try {
        // Getting Error while posting Json Values to the latest solr v8.5.2, So Deleting these two values
        delete pTraceLogInfo.PROCESS_INFO;
        delete pTraceLogInfo.headers;
        solrClient.add(pTraceLogInfo, function (err, response) {
            var blnStatus = false;
            if (err)
                console.log('Error on Solr ' + err);
            else {
                blnStatus = true;
            }
            return pCallback(blnStatus);
        });
    } catch (ex) {
        _WriteLoggingError(ex.stack);
    }
}

// // Insert log message to trace_log table
// function _WriteToCassandra(pData, pCallback) {
//     try {
//         reqDBInstance.InsertFXDB(mLogClient, 'TRACE_LOG', [{
//             // T_ID: reqInstanceHelper.Guid(),
//             ACTION: pData.ACTION ? pData.ACTION : '',
//             // DATETIME: new Date(),
//             ERROR_CODE: pData.ERROR_CODE ? pData.ERROR_CODE : '',
//             LOGTYPE: pData.LOGTYPE ? pData.LOGTYPE : '',
//             MESSAGE: pData.MESSAGE ? pData.MESSAGE : '',
//             //PARENT_PROCESS: pData.PARENT_PROCESS ? pData.PARENT_PROCESS : '',
//             PRCT_ID: pData.PRCT_ID ? pData.PRCT_ID : '',
//             PROCESS: pData.PROCESS ? pData.PROCESS : '',
//             SERVICEURL: pData.SERVICEURL ? pData.SERVICEURL : '',
//             // IS_INDEXED: 'N',
//             // EVENT_TYPE: 'TRACE',
//             APP_DESC: pData.APP_DESC ? pData.APP_DESC : '',
//             APP_ID: pData.APP_ID ? pData.APP_ID : '',
//             CLIENTURL: pData.CLIENTURL ? pData.CLIENTURL : '',
//             HANDLER_CODE: pData.HANDLER_CODE ? pData.HANDLER_CODE : '',
//             SESSION_ID: pData.SESSION_ID ? pData.SESSION_ID : '',
//             STARTTIME: pData.STARTTIME ? pData.STARTTIME.toLocaleString() : null,
//             SYSTEM_DESC: pData.SYSTEM_DESC ? pData.SYSTEM_DESC : '',
//             SYSTEM_ID: pData.SYSTEM_ID ? pData.SYSTEM_ID : '',
//             USER_ID: pData.USER_ID ? pData.USER_ID : '',
//             // USER_NAME: pData.USER_NAME ? pData.USER_NAME : '',
//             ENDTIME: new Date()
//         }], {}, function callbackTraceLog(pError, pResult) {
//             var blnStatus = false;
//             if (pError)
//                 console.log('Error ' + pError.stack);
//             else
//                 blnStatus = true;
//             return pCallback(blnStatus);
//         });
//     } catch (ex) {
//         _WriteLoggingError(ex.stack);
//     }
// }


// Insert log message to trace_log table

function _WriteToDB(pData, pdbSession,Currentroutingkey, pCallback) {
    try {
        if (pData.LOGTYPE != 'ERR') {
            pData.LOGTYPE = 'INFO';
            pData.IS_INFO = 'Y';
            pData.IS_EVENT = 'N';
            pData.ISERROR = 'N';
        }
        // reqTranDBHelper.InsertTranDB(pdbSession, 'TRACE_LOG', [{
        reqDBInstance.InsertFXDB(pdbSession, 'TRACE_LOG', [{
            // T_ID: reqInstanceHelper.Guid(),
            ACTION: pData.ACTION_DESC ? pData.ACTION_DESC : '',
            //DATETIME: new Date(),
            HOST_NAME: pData.HOST_NAME,
            ISERROR: pData.ISERROR,
            IS_EVENT: pData.IS_EVENT,
            IS_INFO: pData.IS_INFO,
            TENANT_ID: pData.TENANT_ID,
            ERROR_CODE: pData.ERROR_CODE ? pData.ERROR_CODE : '',
            LOGTYPE: pData.LOGTYPE ? pData.LOGTYPE : '',
            MESSAGE: pData.MESSAGE ? pData.MESSAGE : '',
            // PARENT_PROCESS: pData.PARENT_PROCESS ? pData.PARENT_PROCESS : '',
            PRCT_ID: pData.PRCT_ID ? pData.PRCT_ID : '',
            PROCESS: pData.PROCESS ? pData.PROCESS : '',
            SERVICEURL: pData.SERVICEURL ? pData.SERVICEURL : '',
            SERVICE_NAME: pData.SERVICE_NAME ? pData.SERVICE_NAME : '',
            PROCESS_INFO: JSON.stringify(pData.PROCESS_INFO),
            //IS_INDEXED: 'N',
            //EVENT_TYPE: 'TRACE',
            APP_DESC: pData.APP_DESC ? pData.APP_DESC : '',
            APP_ID: pData.APP_ID ? pData.APP_ID : '',
            CLIENTURL: pData.CLIENTURL ? pData.CLIENTURL : '',
            HANDLER_CODE: pData.HANDLER_CODE ? pData.HANDLER_CODE : '',
            SESSION_ID: pData.SESSION_ID ? pData.SESSION_ID : '',
            STARTTIME: reqDateFormatter.GetDateTimeWithTenantTZ(pData.headers, {}, pData.STARTTIME),
            SYSTEM_DESC: pData.SYSTEM_DESC ? pData.SYSTEM_DESC : '',
            SYSTEM_ID: pData.SYSTEM_ID ? pData.SYSTEM_ID : '',
            USER_ID: pData.USER_ID ? pData.USER_ID : '',
            LOGIN_NAME: pData.USER_NAME ? pData.USER_NAME : '',
            ENDTIME: reqDateFormatter.GetDateTimeWithTenantTZ(pData.headers, {}, pData.ENDTIME)
        }], {}, function callbackTraceLog(pError, pResult) {
            try {
                if (pError) {
                    console.log('Error ' + pError.stack);
                    delete mLogClient[Currentroutingkey]
                    return pCallback("SUCCESS");
                } else {
                    return pCallback("SUCCESS");
                    // return pCallback(true);
                }
            } catch (error) {
                delete mLogClient[Currentroutingkey]
                return pCallback(false);
            }
        });
    } catch (ex) {
        _WriteLoggingError(ex.stack);
    }
}
// Write event log data to event_log table
function _WriteEventToCassandra(pData, pCallback) {
    try {
        reqDBInstance.InsertFXDB(mLogClient, 'EVENT_LOG', [{
            PRCT_ID: pData.PRCT_ID ? pData.PRCT_ID : '',
            APP_DESC: pData.APP_DESC ? pData.APP_DESC : '',
            APP_ID: pData.APP_ID ? pData.APP_ID : '',
            CLIENTURL: pData.CLIENTURL ? pData.CLIENTURL : '',
            HANDLER_CODE: pData.HANDLER_CODE ? pData.HANDLER_CODE : '',
            SERVICEURL: pData.SERVICEURL ? pData.SERVICEURL : '',
            SESSION_ID: pData.SESSION_ID ? pData.SESSION_ID : '',
            STARTTIME: pData.STARTTIME ? pData.STARTTIME.toLocaleString() : null,
            SYSTEM_DESC: pData.SYSTEM_DESC ? pData.SYSTEM_DESC : '',
            SYSTEM_ID: pData.SYSTEM_ID ? pData.SYSTEM_ID : '',
            USER_ID: pData.USER_ID ? pData.USER_ID : '',
            USER_NAME: pData.USER_NAME ? pData.USER_NAME : '',
            PROCESS: pData.MENU_ITEM_DESC ? pData.MENU_ITEM_DESC : '',
            ACTION: pData.ACTION_DESC ? pData.ACTION_DESC : '',
            ENDTIME: new Date()
        }], objLogInfo, function callbackEventLog(pError, pResult) {
            var blnStatus = false;
            if (pError)
                console.log('Error ' + pError.stack);
            else
                blnStatus = true;
            return pCallback(blnStatus);
        });
    } catch (ex) {
        _WriteLoggingError(ex.stack);
    }
}

function SaveLogToCassandra(strMsg, callback) {
    try {
        //console.log(strMsg);
        var mHeaders = JSON.parse(strMsg.headers);
        reqDBInstance.GetFXDBConnection(mHeaders, 'log_cas', objLogInfo, function CallbackGetCassandraConn(pLogClient) {
            mLogClient = pLogClient;
            writeData(strMsg, 'cassandra', function callbackWriteToSolr(pStatus) {
                try {
                    if (pStatus) {
                        return callback('SUCCESS');
                    } else {
                        return callback('FAILURE');
                    }
                } catch (ex) {
                    _WriteLoggingError(ex.stack);
                }
            });
        });
    } catch (ex) {
        _WriteLoggingError('Error on Log consumer start - ' + ex.stack);
    }
}

function SaveLogToDB(strMsg, callback) {
    try {
        // var mHeaders = JSON.parse(strMsg.headers);
        // var Currentroutingkey = mHeaders.routingkey;
        // // check the connection available
        // if (mLogClient.Currentroutingkey) {
        //     callwriteData(strMsg)
        // } else {
        //     // if not get the connection set into memory along with routingkey
        //     reqDBInstance.GetFXDBConnection(mHeaders, 'log_cas', {}, function CallbackGetCassandraConn(pLogClient) {
        //         mLogClient.Currentroutingkey = pLogClient;
        //         callwriteData(strMsg)
        //     });
        // }

        writeData(strMsg, 'cassandra', function callbackWriteToSolr(pStatus) {
            try {
                if (pStatus) {
                    return callback('SUCCESS');
                } else {
                    return callback('FAILURE');
                }
            } catch (ex) {
                _WriteLoggingError(ex.stack);
            }
        });

    } catch (ex) {
        _WriteLoggingError('Error on Log consumer start - ' + ex.stack);
    }
}

function callwriteData(strMsg) {
    writeData(strMsg, 'cassandra', function callbackWriteToSolr(pStatus) {
        try {
            if (pStatus) {
                return callback('SUCCESS');
            } else {
                return callback('FAILURE');
            }
        } catch (ex) {
            _WriteLoggingError(ex.stack);
        }
    });
}

module.exports = {
    SaveLogToSolr: SaveLogToSolr,
    SaveLogToCassandra: SaveLogToCassandra,
    CommitSolr: commitSolr,
    SaveLogToFile: SaveLogToFile
    , filelogwrite: filelogwrite
    , SaveLogToDB: SaveLogToDB

};
/********* End of File *************/