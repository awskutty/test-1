/****
  @Descriptions     :  Child Thread for reading History common table(HST_TRAN_DATA),
                       and produce it SOLR/KAFKA
                       For Ultimate - Produsing data to kafka
                       For Lite     - Insert data to solr  
  @Last_Error_Code  :  ERR-HST_FX_DATA-PRODUCER-0026
 ****/

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var cron = require('node-cron');
var reqUuid = require('uuid');
var reqOs = require('os');
var reqPath = require('path');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqAsync = require('async');

// Global variable initialization
var serviceName = 'HSTFXTABLEDataProducer';
var recoveryLogPath = reqPath.join(__dirname, '../service_logs/recovery/to_be_processed/');
var containerName = reqOs.hostname();
var blnError = false;
var tasks = [];
// var objLogInfo = null;
var arrRoutingKeys = [];
var maxMemorySize = 300; // In MB
var HistoryTable = 'HST_FX_TABLE_DATA';
var HistoryTableQueryCount = 500;
var deleteFromTable = true;
var restartFlag = false;
var replaceSpecialChar = '';
var lockIDExpiringDuration = '1';
// // Need to Rmmove
// var maxMemorySize = 3; // In MB
// var restartFlag = true;

// Initiate a new scheduler thread using node-cron
function ProduceWithTranDBKey(msgFromMain, callback) {
    var SERVICE_NAME = msgFromMain.SERVICE_NAME;
    var headers = msgFromMain.headers;
    var isTenantMultiThreaded = msgFromMain.headers.IS_TENANT_MULTI_THREADED;

    if (arrRoutingKeys.indexOf(headers.routingkey) == -1) {
        var objLogInfo = JSON.parse(headers.LOG_INFO);
        var GetAllIDsInRoutingKeyObj = { ROUTINGKEY: headers.routingkey };
        var routingkeyInfo = reqInstanceHelper.GetAllIDsInRoutingKey(GetAllIDsInRoutingKeyObj, objLogInfo);
        objLogInfo.TENANT_ID = routingkeyInfo.TENANT_ID;
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
                    // reqInstanceHelper.PrintInfo(serviceName, 'Restart Flag - ' + restartFlag, objLogInfo);
                    // reqInstanceHelper.PrintInfo(serviceName, 'Special Charcter List - ' + replaceSpecialChar, objLogInfo);


                    if (!restartFlag || currentMemorySize < maxMemorySize) {
                        arrRoutingKeys[routingKeyIndex].isDone = false;
                        _InitializeDB(headers, objLogInfo, function callbackInitializeDB(pTranDB) {
                            if (!pTranDB) {
                                arrRoutingKeys[routingKeyIndex].isDone = true;
                            } else {
                                DelegateTranDB(pTranDB, msgFromMain.AppId, headers, objLogInfo, function () {
                                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Tran Data Producer Process Completed...\n\n-----------------------------------------------------------------------------------------------------------------------------------------\n', objLogInfo); //this is for to know api call end'
                                    reqLogWriter.EventUpdate(objLogInfo);
                                    arrRoutingKeys[routingKeyIndex].isDone = true;
                                    arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                                });
                                // });
                            }
                        });
                    } else {
                        // Going to Restart the Service
                        CheckProcessedMsgCountAndRestart(objLogInfo, function (params) { });
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
function DelegateTranDB(pTranDB, pAppID, pHeaders, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Starting history table process..', pLogInfo);
        _DoProcessHistoryTable(pTranDB, pAppID, pHeaders, pLogInfo, function callbackTranDB(pError, pResult, pRowCount) {
            // Closing The Connection 
            reqInstanceHelper.DestroyConn(serviceName, pLogInfo, function (params) {
                pCallback();
            });
        });
    } catch (ex) {
        _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0004', 'Catch Error in DelegateTranDB();...', pLogInfo);
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
function _DoProcessHistoryTable(pSession, pAppID, pHeaders, objLogInfo, pCallback) {
    try {
        _TraceInfo('Processing History table started.', objLogInfo);
        var cond = "process_count IS NULL and lock_id IS NULL order by HFTD_ID ASC ) T";
        var strSelQuery = 'SELECT HFTD_ID FROM ( SELECT  HFTD_ID FROM ' + HistoryTable + ' WHERE ' + cond + ' LIMIT ' + HistoryTableQueryCount;
        if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
            strSelQuery = 'SELECT HFTD_ID FROM ( SELECT HFTD_ID FROM ' + HistoryTable + ' WHERE ' + cond + ' WHERE ROWNUM <=' + HistoryTableQueryCount;
            objLogInfo.isFromOracle = true;
        }
        var lock_id = reqUuid() + '-' + containerName;
        var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
        var hst_tran_data_prct_update_qry = "update " + HistoryTable + " set lock_id = '" + lock_id + "', MODIFIED_DATE = '" + modifiedDate + "' WHERE HFTD_ID IN (" + strSelQuery + ") and process_count IS NULL and lock_id IS NULL";
        var select_after_update_qry = "select * from " + HistoryTable + " where lock_id = '" + lock_id + "'";
        var SeqID = '';
        var RowCount = 0;
        var arrId = [];
        var arrEmptyRoutingKeyId = []; // Collecting Empty Routingkey Data
        reqAsync.series({
            ProcessHistoryTable: function (parCb) {
                try {
                    reqTranDBInstance.ExecuteSQLQuery(pSession, hst_tran_data_prct_update_qry, objLogInfo, function callbackDeleteHistoryTable(result, error) {
                        if (error) {
                            _TraceError(error, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0005', 'Error While Executing hst_tran_data_prct_update_qry in ExecuteSQLQuery()...', objLogInfo);
                            parCb(error, null);
                        } else {
                            // // For Development
                            // var select_after_update_qry = 'SELECT * FROM  HST_FX_TABLE_DATA where HFTD_ID = 1141148';
                            reqTranDBInstance.ExecuteSQLQuery(pSession, select_after_update_qry, objLogInfo, function callbackDeleteHistoryTable(result, error) {
                                if (error) {
                                    _TraceError(error, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0021', 'Error While Executing select_after_update_qry in ExecuteSQLQuery()...', objLogInfo);
                                    parCb(error, null);
                                } else {
                                    RowCount = result.rows.length;
                                    if (RowCount) {
                                        var pResult = {};
                                        pResult.rows = new reqLinq(result.rows)
                                            .OrderBy(function (row) {
                                                return row.hftd_id;
                                            })
                                            .Select(function (row) {
                                                try {
                                                    if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                                                        // To verify the New and old data json value for special characters
                                                        if (row.new_data_json) {
                                                            row.new_data_json = reqInstanceHelper.ReplaceSpecialCharacter(row.new_data_json, replaceSpecialChar.split(','));
                                                        }

                                                        // To verify the old data json value for special characters
                                                        if (row.old_data_json) {
                                                            row.old_data_json = reqInstanceHelper.ReplaceSpecialCharacter(row.old_data_json, replaceSpecialChar.split(','));
                                                        }
                                                    }
                                                } catch (error) {
                                                    _TraceError(error, pHeaders, 'ERR-TRANDATA-PRODUCER-0024', 'Catch Error while Replacing Special Character within the HST data', objLogInfo);
                                                }
                                                return row;
                                            })
                                            .ToArray();
                                        if (pResult) {
                                            var index = 0;
                                            _PrepareAndSaveKafkaMsg(pSession, pAppID, index, RowCount, pResult, SeqID, arrId, arrEmptyRoutingKeyId, pHeaders, objLogInfo, function callbackPrepareAndSaveKafkaMsg(pSeqID) {
                                                arrId = pSeqID;
                                                parCb(null, 'SUCCESS');
                                            });
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
                    _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0007', 'Catch Error in Async Series ProcessHistoryTable();...', objLogInfo);
                    parCb(ex, null);
                }
            },
            UpdateHSTFXtable: function (parCb) {
                try {
                    // deleteFromTable = true;
                    if (!deleteFromTable) {
                        if (arrId.length) {
                            _TraceInfo('Update Count - ' + arrId.length, objLogInfo);
                            var condObj = {
                                'HFTD_ID': arrId
                            };
                            var updateObj = {
                                'PROCESS_COUNT': 1,
                                'LOCK_ID': null,
                                'MODIFIED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                            };
                            reqTranDBInstance.UpdateTranDB(pSession, HistoryTable, updateObj, condObj, objLogInfo, function (pResult, pError) {
                                if (pError) {
                                    blnError = true;
                                    CreateDBUpdateRecoveryLog(condObj, updateObj, pError, pHeaders, function (result) {
                                        _TraceError(pError, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0008', 'Error in Async Series UpdateHSTFXtable - UpdateTranDB();...', objLogInfo);
                                        arrId = [];
                                        parCb();
                                    });
                                } else {
                                    arrId = [];
                                    parCb();
                                }
                            }
                            );
                        } else {
                            _TraceInfo('There is No Eligible Data For Update Process', objLogInfo);
                            parCb(null, 'SUCCESS');
                        }
                    } else {
                        _TraceInfo('Skipping The Update Process because Delete From Table is Enabled', objLogInfo);
                        parCb(null, 'SUCCESS');
                    }
                } catch (ex) {
                    _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0009', 'Catch Error in Async Series DeleteHistory();...', objLogInfo);
                    parCb(ex, null);
                }
            },

            DeleteHSTFXtable: function (DeleteHSTFXtableCB) {
                try {
                    // deleteFromTable = false;
                    if (deleteFromTable) {
                        if (arrId.length) {
                            _TraceInfo('Delete Count - ' + arrId.length, objLogInfo);
                            var condObj = {
                                'HFTD_ID': arrId
                            };
                            reqTranDBInstance.DeleteTranDB(pSession, HistoryTable, condObj, objLogInfo, function (pResult, pError) {
                                if (pError) {
                                    CreateDBDeleteRecoveryLog(condObj, pError, pHeaders, function (result) {
                                        _TraceError(pError, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0008', 'Error in Async Series DeleteHistory - UpdateTranDB();...', objLogInfo);
                                        arrId = [];
                                        DeleteHSTFXtableCB();
                                    });
                                    blnError = true;
                                } else {
                                    arrId = [];
                                    DeleteHSTFXtableCB();
                                }
                            }
                            );
                        } else {
                            DeleteHSTFXtableCB(null, 'SUCCESS');
                        }
                    } else {
                        DeleteHSTFXtableCB(null, 'SUCCESS');
                    }
                } catch (ex) {
                    _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0009', 'Catch Error in Async Series DeleteHistory();...', objLogInfo);
                    DeleteHSTFXtableCB(ex, null);
                }
            }
            , HandlingOldLockIDs: function (HandlingOldLockIDsCB) {
                try {
                    var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                    var cond = ' AND LOCK_ID IS NOT NULL';
                    var handlingOldLockIDDataQry = "select HFTD_ID from " + HistoryTable + " WHERE MODIFIED_DATE <= cast('" + modifiedDate + "' as timestamp) - INTERVAL '" + lockIDExpiringDuration + "' HOUR " + cond;
                    if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                        handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' AND ROWNUM <= ' + HistoryTableQueryCount;
                    } else {
                        handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' LIMIT ' + HistoryTableQueryCount;
                    }
                    var handlingOldLockIDDataUpdateQry = "UPDATE " + HistoryTable + " SET LOCK_ID = NULL, MODIFIED_DATE = '" + modifiedDate + "', COMMENTS = 'Making Old Lock IDs to NULL' WHERE HFTD_ID IN (" + handlingOldLockIDDataQry + ") AND PROCESS_COUNT IS NULL and LOCK_ID IS NOT NULL";
                    reqTranDBInstance.ExecuteSQLQuery(pSession, handlingOldLockIDDataUpdateQry, objLogInfo, function (result, error) {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HST_FX_DATA-PRODUCER-0022', 'Error While Executing handlingOldLockIDDataQry in ExecuteSQLQuery()...', error);
                        }
                        HandlingOldLockIDsCB();
                    });

                } catch (ex) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HST_FX_DATA-PRODUCER-0023', 'Catch Error in Async Series DeleteHistory();...', error);
                    HandlingOldLockIDsCB(ex, null);
                }
            }
            , UpdateEmptyRoutingKeyData: function (UpdateEmptyRoutingKeyDataCB) {
                try {
                    if (arrEmptyRoutingKeyId.length) { // Length Should Not Exceeding 999, if exceeds, it will throw error
                        reqInstanceHelper.PrintInfo(serviceName, 'Empty Routingkey Data Count | ' + arrEmptyRoutingKeyId.length, objLogInfo);
                        reqTranDBInstance.UpdateTranDB(pSession, HistoryTable, {
                            'IS_PROCESSED': 'Y',
                            'COMMENTS': 'Routingkey is empty',
                            'LOCK_ID': null,
                            'PROCESS_COUNT': 2,
                            'MODIFIED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                        }, {
                            'HFTD_ID': arrEmptyRoutingKeyId
                        }, objLogInfo, function (pResult, error) {
                            if (error) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Empty Routingkey Data - ' + arrEmptyRoutingKeyId.toString(), objLogInfo);
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HST_FX_DATA-PRODUCER-0026', 'Error While Updating the Empty Routingkey Data', error);
                            }
                            arrEmptyRoutingKeyId = [];
                            UpdateEmptyRoutingKeyDataCB();
                        }
                        );
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'There is No Empty Routingkey Data', objLogInfo);
                        UpdateEmptyRoutingKeyDataCB();
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HST_FX_DATA-PRODUCER-0025', 'Catch Error in Async Series DeleteHistory();...', error);
                    UpdateEmptyRoutingKeyDataCB();
                }
            }
        }, function (err, results) {
                if (err) {
                    _TraceError(err, pHead0ers, 'ERR-HST_FX_DATA-PRODUCER-0010', 'Error in Async Series Final Callback();...', objLogInfo);
                } else {
                    _TraceInfo("History table processing and Update PRocess Count process completed", objLogInfo);
                }
                pCallback(err, results, RowCount);
            });
    } catch (ex) {
        _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0011', 'Catch Error in _DoProcessHistoryTable();...', objLogInfo);
        pCallback(ex, [], 0);
    }
}

function CreateDBUpdateRecoveryLog(condObj, updateObj, error, pHeaders, CreateDBUpdateRecoveryLogCB) {
    try {
        var fileContent = {
            STATE: 'DB_UPDATE_FAILURE',
            ACTION: 'DB_UPDATE',
            TABLE_NAME: HistoryTable,
            ROUTINGKEY: pHeaders.routingkey,
            CONDITION_OBJ: condObj
            , UPDATE_OBJ: updateObj
            , ERROR: error.stack || error
        };
        fileContent = JSON.stringify(fileContent, null, '\t');
        var fileName = reqInstanceHelper.GetServiceFileName(pHeaders);
        reqInstanceHelper.WriteServiceLog(recoveryLogPath, fileName, fileContent, CreateDBUpdateRecoveryLogCB);
    } catch (error) {
        CreateDBUpdateRecoveryLogCB();
    }
}


function CreateDBDeleteRecoveryLog(condObj, error, pHeaders, CreateDBDeleteRecoveryLogCB) {
    try {
        var fileContent = {
            STATE: 'DB_DELETE_FAILURE',
            ACTION: 'DB_DELETE',
            TABLE_NAME: HistoryTable,
            ROUTINGKEY: pHeaders.routingkey,
            CONDITION_OBJ: condObj
            , ERROR: error.stack || error
        };
        fileContent = JSON.stringify(fileContent, null, '\t');
        var fileName = reqInstanceHelper.GetServiceFileName(pHeaders);
        reqInstanceHelper.WriteServiceLog(recoveryLogPath, fileName, fileContent, CreateDBDeleteRecoveryLogCB);
    } catch (error) {
        CreateDBDeleteRecoveryLogCB();
    }
}



// Prepare json message and produce it
function _PrepareAndSaveKafkaMsg(pSession, pAppID, pIndex, pRowCount, pResult, pSequenceId, parrId, parrEmptyRoutingKeyId, pHeader, pLogInfo, pCallback) {
    try {
        _TraceInfo('Preparing the message that to be produced', pLogInfo);
        try {
            pHeader.LOG_INFO = pLogInfo;
            _ProduceKafkaMessage(pResult.rows[pIndex]['hftd_id'].toString(), pResult.rows[pIndex], pHeader, pLogInfo, function callbackProduceMsg(pStatus, pSeqId) {
                try {
                    if (pStatus == 'SUCCESS') {
                        parrId.push(pSeqId);
                    } else if (pStatus == 'NO_ROUTINGKEY') {
                        parrEmptyRoutingKeyId.push(pSeqId);
                    }
                    pSequenceId = pSeqId;
                    pIndex = pIndex + 1;
                    if (pIndex == pRowCount) {
                        // if (pIndex == pRowCount || pStatus == 'FAILURE')
                        pCallback(parrId);
                    }
                    else {
                        _PrepareAndSaveKafkaMsg(pSession, pAppID, pIndex, pRowCount, pResult, pSequenceId, parrId, parrEmptyRoutingKeyId, pHeader, pLogInfo, pCallback);
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
function CheckProcessedMsgCountAndRestart(pLogInfo, CheckProcessedMsgCountAndRestartCB) {
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
var kafkaTopic = 'PRF.hst_fx_table_data';
function _ProduceKafkaMessage(pSeqId, pKafkaObj, pHeaders, objLogInfo, pCallback) {
    if (Object.keys(pKafkaObj).length == 0) {
        _TraceInfo('There is No Data For HFTD_ID - ' + pSeqId, objLogInfo);
        pCallback('SUCCESS', pSeqId);
    }
    else {
        try {
            var topicName = '';
            _TraceInfo('Producing Msg Started for HFTD_ID - ' + pSeqId, objLogInfo);
            if (objLogInfo.isFromOracle) {
                topicName = kafkaTopic.toUpperCase();
            } else {
                topicName = kafkaTopic;
            }
            topicName = topicName.replace(/~/g, '_'); // If Replace is Not Done then It will not create a Kfka Topic
            _TraceInfo('Current Topic Name - ' + topicName, objLogInfo);
            if (pKafkaObj.routingkey) {
                var kafkaTopicData = { HST_DATA: pKafkaObj, ROUTING_KEY: pKafkaObj.routingkey };
                // Producing Kafka Msg into Two Different Topics Based on the DB Type
                reqProducer.ProduceMessage(topicName, kafkaTopicData, pHeaders, function (result) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Producing Result - ' + result, objLogInfo);
                    pCallback(result, pSeqId);
                });
            } else {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HST_FX_DATA-PRODUCER-0024', 'Routing key is Empty', '');
                pCallback('NO_ROUTINGKEY', pSeqId);
            }
        } catch (ex) {
            _TraceError(ex, pHeaders, 'ERR-HST_FX_DATA-PRODUCER-0019', 'Catch Error in _ProduceKafkaMessage()...', objLogInfo);
            pCallback('SUCCESS', pSeqId);
        }
    }
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
    ProduceWithTranDBKey: ProduceWithTranDBKey
};
/******** End of File **********/