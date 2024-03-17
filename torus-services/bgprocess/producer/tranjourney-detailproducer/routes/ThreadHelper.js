/****
  @Descriptions     :  Child Thread for reading History common table(HST_TRAN_DATA),
                       and produce it SOLR/KAFKA
                       For Ultimate - Produsing data to kafka
                       For Lite     - Insert data to solr  
@Last_Error_Code  :  ERR_TRAN_JOURNEY_THREAD_HELPER_0001
 ****/

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var cron = require('node-cron');
var reqUuid = require('uuid');
var reqOs = require('os');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqAsync = require('async');

// Global variable initialization
var serviceName = 'TRANJourneyThreadHelper';
var containerName = reqOs.hostname();
var strStartIndex = '';
var blnError = false;
var tasks = [];
// var objLogInfo = null;
var arrRoutingKeys = [];
var maxMemorySize = 300; // In MB
var HistoryTable = 'TRANSACTION_JOURNEY_DETAIL';
var HistoryTableQueryCount = 500;
var deleteFromTable = true;
var restartFlag = false;
var replaceSpecialChar = '';
var lockIDExpiringDuration = '1';
// // Need to Rmmove
// var maxMemorySize = 3; // In MB
// var restartFlag = true;
// var HistoryTableQueryCount = 1;

// Initiate a new scheduler thread using node-cron
function initiateThread(msgFromMain, callback) {
    var SERVICE_NAME = msgFromMain.SERVICE_NAME;
    var headers = msgFromMain.headers;
    var isTenantMultiThreaded = msgFromMain.headers.IS_TENANT_MULTI_THREADED;

    if (arrRoutingKeys.indexOf(headers.routingkey) == -1) {
        var objLogInfo = JSON.parse(headers.LOG_INFO);
        var GetAllIDsInRoutingKeyObj = { ROUTINGKEY: headers.routingkey };
        var routingkeyInfo = reqInstanceHelper.GetAllIDsInRoutingKey(GetAllIDsInRoutingKeyObj, objLogInfo);
        objLogInfo.TIMEZONE_INFO = routingkeyInfo.TENANT_ID;
        objLogInfo.IS_TENANT_MULTI_THREADED = isTenantMultiThreaded;
        var GetTenantLevelTimezoneObj = { TENANT_ID: routingkeyInfo.TENANT_ID };
        objLogInfo.TIMEZONE_INFO = reqInstanceHelper.GetTenantLevelTimezone(GetTenantLevelTimezoneObj, objLogInfo);
        var objRoutingKey = {
            routingkey: headers.routingkey,
            isDone: true,
            objLogInfo: objLogInfo,
            lastLoopingCount: 0,
            maxLoopingCount: 180
        }
        arrRoutingKeys.push(objRoutingKey);
    }

    reqInstanceHelper.PrintInfo(serviceName, 'Creating new cron job for current key', objLogInfo);
    var task = cron.schedule('*/10 * * * * *', function () {
        try {
            var currentRoutingKey = headers.routingkey;
            var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == headers.routingkey);

            var objLogInfo = arrRoutingKeys[routingKeyIndex].objLogInfo; // Assiging unique Loginfo for Each Routing Key
            reqInstanceHelper.PrintInfo(serviceName, 'Current Rounting Key - ' + currentRoutingKey, objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'TimeZone Info - ' + objLogInfo.TIMEZONE_INFO, objLogInfo);
            // return;
            
            reqInstanceHelper.GetRedisServiceParamConfig(null, function (error, result) {
                if (error) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Redis Service Param Config for the key - ' + currentRoutingKey, objLogInfo);
                } else {
                    if (result) {
                        result = JSON.parse(result);
                        var serviceParam = result[SERVICE_NAME];
                        if ('RESTART_MEMORY_VALUE_MB' in serviceParam) {
                            maxMemorySize = serviceParam.RESTART_MEMORY_VALUE_MB;
                        }
                        if ('RESTART_FLAG' in serviceParam) {
                            restartFlag = serviceParam.RESTART_FLAG;
                        }
                        if ('MAX_ELIGIBLE_COUNT' in serviceParam) {
                            HistoryTableQueryCount = serviceParam.MAX_ELIGIBLE_COUNT;
                        }
                        if ('DELETE_PROCESSED_RECORD' in serviceParam) {
                            deleteFromTable = serviceParam.DELETE_PROCESSED_RECORD;
                        }
                        if ('LOCKID_EXPIRING_DURATION_HR' in serviceParam) {
                            lockIDExpiringDuration = serviceParam.LOCKID_EXPIRING_DURATION_HR;
                        }
                        if ('REPLACE_SPECIAL_CHARCTER' in result) {
                            replaceSpecialChar = result.REPLACE_SPECIAL_CHARCTER;
                        }
                    }
                    // // Need to Rmmove
                    // var maxMemorySize = 3; // In MB
                    // var restartFlag = true;
                }
                arrRoutingKeys[routingKeyIndex].lastLoopingCount++;

                if (arrRoutingKeys[routingKeyIndex].isDone) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Next scheduled thread started for the key - ' + currentRoutingKey + ' is Checking For Transaction...', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Maximum Memory Size - ' + maxMemorySize + ' MB', objLogInfo);
                    var currentMemorySize = (process.memoryUsage().rss) / (1024 * 1024);
                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Current Memory Size - ' + currentMemorySize + ' MB', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Restart Flag - ' + restartFlag, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Special Charcter List - ' + replaceSpecialChar, objLogInfo);


                    if (!restartFlag || currentMemorySize < maxMemorySize) {
                        arrRoutingKeys[routingKeyIndex].isDone = false;
                        _InitializeDB(headers, objLogInfo, function callbackInitializeDB(pTranDB) {
                            if (!pTranDB) {
                                arrRoutingKeys[routingKeyIndex].isDone = true;
                            } else {
                                DelegateTranDB(pTranDB, msgFromMain.AppId, headers, objLogInfo, function () {
                                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Tran Journey Data Producer Process Completed...\n\n-----------------------------------------------------------------------------------------------------------------------------------------\n', objLogInfo); //this is for to know api call end'
                                    reqLogWriter.EventUpdate(objLogInfo);
                                    arrRoutingKeys[routingKeyIndex].isDone = true;
                                    arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                                });
                                // });
                            }
                        });
                    } else {
                        // Going to Restart the Service
                        CheckProcessedMsgCountAndRestart(null, objLogInfo, function (params) { });
                    }

                } else {
                    _TraceInfo('Already a cron thread is processing. So skiping this cron thread.' + headers.routingkey + ' IsDone = ' + arrRoutingKeys[routingKeyIndex].isDone, objLogInfo);
                    _TraceInfo('Last Looping Count - ' + arrRoutingKeys[routingKeyIndex].lastLoopingCount, objLogInfo);
                    if (arrRoutingKeys[routingKeyIndex].lastLoopingCount > arrRoutingKeys[routingKeyIndex].maxLoopingCount) {
                        _TraceInfo('Looping Count Exceeds the Maximum Looping Count...So Resetting the ISDONE to True', objLogInfo);
                        arrRoutingKeys[routingKeyIndex].isDone = true;
                        arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                    }
                }
            });
            //task.stop(); //this stops scheduler 
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HST_FX_DATA-PRODUCER-0001', 'Catch Error in cron.schedule() While adding a New CRON Job...', error);
        }
    });
    tasks.push(task);
    return callback('started');
}

// Query common history table
// Produce it to kafka
// Then delete processed data from table
function DelegateTranDB(pTranDB, pAppID, pHeader, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Starting history table process..', pLogInfo);
        _DoProcessHistoryTable(pTranDB, pAppID, pHeader, pLogInfo, function callbackTranDB(pError, pResult, pRowCount) {
            // Closing The Connection 
            reqInstanceHelper.DestroyConn(serviceName, pLogInfo, function (params) {
                pCallback();
            });
        });
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-HST_FX_DATA-PRODUCER-0004', 'Catch Error in DelegateTranDB();...', pLogInfo);
        // Closing The Connection 
        reqInstanceHelper.DestroyConn(serviceName, pLogInfo, function (params) {
            pCallback();
        });
    }
}

// Initialize dep cas and tran db instances 
function _InitializeDB(pHeaders, objLogInfo, pCallback) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqTranDBInstance.LoadTranDBClient(serviceModel);
        pHeaders.LOG_INFO = objLogInfo;
        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            _TraceInfo('Initialze DB ended', objLogInfo);
            pCallback(pSession);
        });
        // });
    } catch (ex) {
        _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0003', 'Catch Error in _InitializeDB();...', objLogInfo);
        pCallback(null, null);
    }
}

// Query data from HST_TRAN_DATA with limit 100 and produce it to kafka/solr and then delete from table
function _DoProcessHistoryTable(pSession, pAppID, pHeaders, pLogInfo, pCallback) {
    try {
        _TraceInfo('Processing History table started.', pLogInfo);
        var cond = "process_count IS NULL and lock_id IS NULL and UPPER(routingkey) = UPPER('" + pHeaders.routingkey + "') order by TJD_ID ASC ) T";
        var strSelQuery = 'SELECT TJD_ID FROM ( SELECT TJD_ID FROM ' + HistoryTable + ' WHERE ' + cond + ' LIMIT ' + HistoryTableQueryCount;
        if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
            strSelQuery = 'SELECT TJD_ID FROM ( SELECT TJD_ID FROM ' + HistoryTable + ' WHERE ' + cond + ' WHERE ROWNUM <= ' + HistoryTableQueryCount;
            pLogInfo.isFromOracle = true;
        }
        var lock_id = reqUuid() + '-' + containerName;
        var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, pLogInfo);
        var hst_tran_data_prct_update_qry = "update " + HistoryTable + " set lock_id = '" + lock_id + "', MODIFIED_DATE = '" + modifiedDate + "' WHERE TJD_ID IN (" + strSelQuery + ") and process_count IS NULL and lock_id IS NULL";
        var select_after_update_qry = "select * from " + HistoryTable + " where lock_id = '" + lock_id + "'";
        var SeqID = '';
        var RowCount = 0;
        var arrId = [];
        reqAsync.series({
            ProcessHistoryTable: function (parCb) {
                try {
                    reqTranDBInstance.ExecuteSQLQuery(pSession, hst_tran_data_prct_update_qry, pLogInfo, function callbackDeleteHistoryTable(result, error) {
                        if (error) {
                            _TraceError(error, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0005', 'Error While Executing hst_tran_data_prct_update_qry in ExecuteSQLQuery()...', pLogInfo);
                            parCb(error, null);
                        } else {
                            reqTranDBInstance.ExecuteSQLQuery(pSession, select_after_update_qry, pLogInfo, function callbackDeleteHistoryTable(result, error) {
                                if (error) {
                                    _TraceError(error, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0021', 'Error While Executing select_after_update_qry in ExecuteSQLQuery()...', pLogInfo);
                                    parCb(error, null);
                                } else {
                                    RowCount = result.rows.length;
                                    if (RowCount) {
                                        var pResult = {};
                                        pResult.rows = new reqLinq(result.rows)
                                            .OrderBy(function (row) {
                                                return row.TJD_ID;
                                            })
                                            .Select(function (row) {
                                                return row;
                                            })
                                            .ToArray();
                                        if (pResult) {
                                            if (blnError && strStartIndex == pResult.rows[0]['tjd_id']) {
                                                _TraceError('Error', pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0006', 'Already produced the sequenceID into Kafka - ' + pResult.rows[0]['TJD_ID'], pLogInfo);
                                                parCb(null, 'SUCCESS');
                                            } else {
                                                var index = 0;
                                                _PrepareAndSaveKafkaMsg(pSession, pAppID, index, RowCount, pResult, SeqID, arrId, pHeaders, pLogInfo, function callbackPrepareAndSaveKafkaMsg(pSeqID) {
                                                    arrId = pSeqID;
                                                    parCb(null, 'SUCCESS');
                                                });
                                            }
                                        }
                                    } else {
                                        parCb(null, 'SUCCESS');
                                    }
                                }
                            });
                        }
                    });
                }
                catch (ex) {
                    _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0007', 'Catch Error in Async Series ProcessHistoryTable();...', pLogInfo);
                    parCb(ex, null);
                }
            },
            UpdateHSTFXtable: function (parCb) {
                try {
                    if (arrId.length) {
                        reqTranDBInstance.UpdateTranDB(pSession, HistoryTable, {
                            'PROCESS_COUNT': 1,
                            'LOCK_ID': null,
                            'MODIFIED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, pLogInfo)
                        }, {
                            'TJD_ID': arrId
                        }, pLogInfo, function (pResult, pError) {
                            if (pError) {
                                _TraceError(pError, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0008', 'Error in Async Series DeleteHistory - UpdateTranDB();...', pLogInfo);
                                blnError = true;
                            }
                            arrId = [];
                            parCb(pError, pResult);
                        }
                        );
                    } else {
                        parCb(null, 'SUCCESS');
                    }
                } catch (ex) {
                    _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0009', 'Catch Error in Async Series DeleteHistory();...', pLogInfo);
                    parCb(ex, null);
                }
            }
            , HandlingOldLockIDs: function (HandlingOldLockIDsCB) {
                try {
                    var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, pLogInfo);
                    var cond = ' AND LOCK_ID IS NOT NULL';
                    var handlingOldLockIDDataQry = "select TJD_ID from " + HistoryTable + " WHERE MODIFIED_DATE <=  cast('" + modifiedDate + "' as timestamp) - INTERVAL '" + lockIDExpiringDuration + "' HOUR " + cond;
                    if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                        handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' AND ROWNUM <= ' + HistoryTableQueryCount;
                    } else {
                        handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' LIMIT ' + HistoryTableQueryCount;
                    }
                    var handlingOldLockIDDataUpdateQry = "UPDATE " + HistoryTable + " SET LOCK_ID = NULL, MODIFIED_DATE = '" + modifiedDate + "', COMMENTS = 'Making Old Lock IDs to NULL' WHERE TJD_ID IN (" + handlingOldLockIDDataQry + ") AND PROCESS_COUNT IS NULL and LOCK_ID IS NOT NULL";
                    reqTranDBInstance.ExecuteSQLQuery(pSession, handlingOldLockIDDataUpdateQry, pLogInfo, function (result, error) {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR_TRAN_JOURNEY_DATA_PRODUCER_0001', 'Error While Executing handlingOldLockIDDataQry in ExecuteSQLQuery()...', error);
                        }
                        HandlingOldLockIDsCB();
                    });

                } catch (ex) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR_TRAN_JOURNEY_DATA_PRODUCER_0002', 'Catch Error in Async Series DeleteHistory();...', error);
                    HandlingOldLockIDsCB(ex, null);
                }
            }
        },
            function (err, results) {
                if (err) {
                    _TraceError(err, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0010', 'Error in Async Series Final Callback();...', pLogInfo);
                } else {
                    _TraceInfo("History table processing and Update PRocess Count process completed", pLogInfo);
                }
                pCallback(err, results, RowCount);
            });
    } catch (ex) {
        _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0011', 'Catch Error in _DoProcessHistoryTable();...', pLogInfo);
        pCallback(ex, [], 0);
    }
}


// Prepare json message and produce it
function _PrepareAndSaveKafkaMsg(pSession, pAppID, pIndex, pRowCount, pResult, pSequenceId, parrId, pHeader, pLogInfo, pCallback) {
    try {
        _TraceInfo('Preparing the message that to be produced', pLogInfo);
        var objKafkaMessage = '';
        try {
            pHeader.LOG_INFO = pLogInfo;
            _ProduceKafkaMessage(pResult.rows[pIndex]['tjd_id'].toString(), pResult.rows[pIndex], pHeader, pLogInfo, function callbackProduceMsg(pStatus, pSeqId) {
                try {
                    if (pStatus == 'SUCCESS') {
                        pSequenceId = pSeqId;//(pSequenceId == '') ? pSeqId : pSequenceId + ',' + pSeqId
                        if (pIndex == 0)
                            strStartIndex = pSeqId;
                        pIndex = pIndex + 1;
                        parrId.push(pSeqId);
                    }
                    if (pIndex == pRowCount || pStatus == 'FAILURE')
                        pCallback(parrId);
                    else {
                        _PrepareAndSaveKafkaMsg(pSession, pAppID, pIndex, pRowCount, pResult, pSequenceId, parrId, pHeader, pLogInfo, pCallback);
                    }
                } catch (ex) {
                    _TraceError(ex, pHeader, 'ERR-HST_FX_DATA-PRODUCER-0014', 'Catch Error in _ProduceKafkaMessage() Callback...', pLogInfo);
                    pCallback(parrId);
                }
            });
        } catch (ex) {
            _TraceError(ex, pHeader, 'ERR-HST_FX_DATA-PRODUCER-0013', 'Catch Error in _PrepareMessage() Callback...', pLogInfo);
            pCallback(parrId);
        }
        // })
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-HST_FX_DATA-PRODUCER-0012', 'Catch Error in _PrepareAndSaveKafkaMsg()...', pLogInfo);
        pCallback(parrId);
    }
}


// To Verify and Restart the Service Based on the processed msg Count and Maximum Processing Msg Count
// Temporary Code For Memory Leak
function CheckProcessedMsgCountAndRestart(params, pLogInfo, CheckProcessedMsgCountAndRestartCB) {
    try {
        var isAllThreadProcessCompleted = true;
        for (let g = 0; g < arrRoutingKeys.length; g++) {
            const element = arrRoutingKeys[g];
            // Checking whether all thread processes are completed
            if (!element.isDone) {
                // Process Not Completed
                isAllThreadProcessCompleted = false;
                reqInstanceHelper.PrintInfo(serviceName, element.routingkey + ' - Process is Not Completed and Service Will not be going to Restart...', pLogInfo);
            }
        }
        if (isAllThreadProcessCompleted) {
            reqInstanceHelper.PrintInfo(serviceName, 'Going to Restart the Service...', pLogInfo);
            reqLogWriter.EventUpdate(pLogInfo);
            reqInstanceHelper.restartSvc(pLogInfo);
        } else {
            reqInstanceHelper.PrintInfo(serviceName, 'Process is Not Completed in some other thread, so waiting to complete the remaining process', pLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'Thread Informations - ' + JSON.stringify(arrRoutingKeys), pLogInfo);
            reqLogWriter.EventUpdate(pLogInfo);
        }
    } catch (error) {
        CheckProcessedMsgCountAndRestartCB(error, null);
    }
}
// Produce the prepared messages
var kafkaTopic = 'TRAN_JOURNEY_TO_SOLR';
function _ProduceKafkaMessage(pSeqId, pKafkaObj, pHeader, pLogInfo, pCallback) {
    if (Object.keys(pKafkaObj).length == 0) {
        _TraceInfo('There is No Data For TJD_ID - ' + pSeqId, pLogInfo);
        pCallback('SUCCESS', pSeqId);
    }
    else {
        try {
            var dataUpperCase = _objKeyToUpperCase(pKafkaObj, pHeader);
            _TraceInfo('Producing Msg Started for TJD_ID - ' + pSeqId, pLogInfo);

            // Producing Kafka Msg into Two Different Topics Based on the DB Type
            dataUpperCase.id = dataUpperCase.TJD_ID; // Used for Solr Upsert in TRAN_JOUNREY SOLR CORE
            reqProducer.ProduceMessage(kafkaTopic, dataUpperCase, pHeader, function (result) {
                reqInstanceHelper.PrintInfo(serviceName, 'Producing Result - ' + result, pLogInfo);
                pCallback(result, pSeqId);
            });
        } catch (ex) {
            _TraceError(ex, pHeader, 'ERR-HST_FX_DATA-PRODUCER-0019', 'Catch Error in _ProduceKafkaMessage()...', pLogInfo);
            pCallback('SUCCESS', pSeqId);
        }
    }
}
var ColumnToRemove = ['is_processed', 'process_count', 'lock_id'];
function _objKeyToUpperCase(pObj, pHeader) {
    try {

        var objForReturn = new Object();
        for (var key in pObj) {
            if (ColumnToRemove.indexOf(key) > -1) {
                continue;
            } else {
                var strUpperCaseKey = key.toUpperCase();
                objForReturn[strUpperCaseKey] = pObj[key];
            }
        }
        return objForReturn;
    } catch (error) {
        _TraceError(error, pHeader, 'ERR-HST_FX_DATA-PRODUCER-0020', 'Catch Error in _objKeyToUpperCase()...', pLogInfo);
    }
}

function _ToDate(pDate) {
    var Restr = reqDateFormat(pDate, "yyyy-mm-dd HH:MM:ss:MMM");
    return Restr;
}

// To print error messages
function _TraceError(pErrorObj, pHeader, pErrorCode, pErrInfoMesg, pLogInfo) {
    try {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, pErrorCode, pErrInfoMesg, pErrorObj);
        if (arrRoutingKeys.length == 1) {
            arrRoutingKeys[0].isDone = true;
        }
        else {
            var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == pHeader.routingkey);
            arrRoutingKeys[routingKeyIndex].isDone = true;
        }
    }
    catch (e) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-HST_FX_DATA-PRODUCER-0002', 'Catch Error in _TraceError();...', e);
    }
}
// To print log info messages
function _TraceInfo(pMsg, pLogInfo) {
    reqInstanceHelper.PrintInfo(serviceName, pMsg, pLogInfo);
}

module.exports = {
    InitiateThread: initiateThread
};
/******** End of File **********/