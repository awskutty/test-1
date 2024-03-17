/****
   @Descriptions     :  Child process to insert the trna_data details to solr/kafka from HST_PRC_TOKENS table
                        For Ultimate - Produce data to kafka
                        For Lite     - Insert data to solr 
   @Last_Error_Code  :  ERR_PRCT_PRODUCER_WORKER_00018
 ****/

// Require dependencies
var cron = require('node-cron');
var reqUuid = require('uuid');
var reqAsync = require('async');
var reqPath = require('path');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqProducer = require('../../../../../torus-references/common/Producer');

// Global variable initialization
var serviceName = 'PrctDataProducerWorker';
var recoveryLogPath = reqPath.join(__dirname, '../service_logs/recovery/to_be_processed/');
var HistoryTable = '';
var historyTableKeyColumn = '';
if (global.isLatestPlatformVersion) {
    HistoryTable = 'PRC_TOKENS';
    historyTableKeyColumn = 'PRCT_ID';
} else {
    HistoryTable = 'HST_PRC_TOKENS';
    historyTableKeyColumn = 'ID';
}
var task = null;
var tasks = [];
var arrRoutingKeys = [];
var maxMemorySize = 300; // In MB
var HistoryTableQueryCount = 500;
var deleteFromTable = true;
var restartFlag = false;
var lockIDExpiringDuration = '1';

// Initiate a new scheduler thread using node-cron
function ProduceWithTranDBKey(msgFromMain, callback) {
    var SERVICE_NAME = msgFromMain.SERVICE_NAME;
    var headers = msgFromMain.headers;
    var isTenantMultiThreaded = msgFromMain.headers.IS_TENANT_MULTI_THREADED;

    var serviceParams = msgFromMain.SERVICE_PARAMS || {};
    if (serviceParams.RESTART_MEMORY_VALUE_MB) {
        maxMemorySize = serviceParams.RESTART_MEMORY_VALUE_MB; // Assigning the Memory Size from the Redis Service Params 
    }
    if (serviceParams.RESTART_FLAG) {
        // Assigning the RESTART_FLAG from the Redis Service Params 
        restartFlag = serviceParams.RESTART_FLAG;
    }

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


    task = cron.schedule('*/10 * * * * *', function () {

        try {
            var currentRoutingKey = headers.routingkey;
            var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == headers.routingkey);

            var objLogInfo = arrRoutingKeys[routingKeyIndex].objLogInfo; // Assiging unique Loginfo for Each Routing Key
            reqInstanceHelper.PrintInfo(serviceName, 'Current Rounting Key - ' + currentRoutingKey, null);
            // reqInstanceHelper.PrintInfo(serviceName, 'TimeZone Info - ' + objLogInfo.TIMEZONE_INFO, null);
            // return

            var GetRedisServiceParamConfigReqObj = {
                objLogInfo: objLogInfo,
                SERVICE_NAME: SERVICE_NAME
            };

            reqInstanceHelper.GetRedisServiceParamConfig(GetRedisServiceParamConfigReqObj, function (error, result) {
                if (error) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Redis Service Param Config for the key - ' + currentRoutingKey, objLogInfo);
                } else {
                    if (result) {
                        if ('RESTART_MEMORY_VALUE_MB' in result) {
                            maxMemorySize = result.RESTART_MEMORY_VALUE_MB;
                        }
                        if ('RESTART_FLAG' in result) {
                            restartFlag = result.RESTART_FLAG;
                        }
                        if ('MAX_ELIGIBLE_COUNT' in result) {
                            HistoryTableQueryCount = result.MAX_ELIGIBLE_COUNT;
                        }
                        if ('DELETE_PROCESSED_RECORD' in result) {
                            deleteFromTable = result.DELETE_PROCESSED_RECORD;
                        }
                        if ('LOCKID_EXPIRING_DURATION_HR' in result) {
                            lockIDExpiringDuration = result.LOCKID_EXPIRING_DURATION_HR;
                        }
                    }
                }

                arrRoutingKeys[routingKeyIndex].lastLoopingCount++;

                if (arrRoutingKeys[routingKeyIndex].isDone) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Next scheduled thread started for the key - ' + currentRoutingKey + ' is Checking For Transaction...', objLogInfo);
                    // reqInstanceHelper.PrintInfo(serviceName, `Total Prct Data Producer Processed Count - Current Routing Key -  ${currentRoutingKey} -  ${arrRoutingKeys[routingKeyIndex].maxPrctdataproducerProcessCount}`, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Maximum Memory Size - ' + maxMemorySize + ' MB', null);
                    var currentMemorySize = (process.memoryUsage().rss) / (1024 * 1024);
                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Current Memory Size - ' + currentMemorySize + ' MB', objLogInfo);
                    // reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Restart Flag - ' + restartFlag, objLogInfo);

                    if (!restartFlag || currentMemorySize < maxMemorySize) {
                        arrRoutingKeys[routingKeyIndex].isDone = false;
                        doPrctProduce(headers, objLogInfo, routingKeyIndex, currentRoutingKey, function () {
                            reqLogWriter.EventUpdate(objLogInfo);
                            arrRoutingKeys[routingKeyIndex].isDone = true;
                            arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                        });
                    } else {
                        // Going to Restart the Service
                        CheckProcessedMsgCountAndRestart(null, objLogInfo, function (params) { })
                    }

                } else {
                    reqInstanceHelper.PrintInfo(serviceName, headers.routingkey + 'Already a cron thread is processing. So skiping this cron thread.  IsDone = ' + arrRoutingKeys[routingKeyIndex].isDone, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Last Looping Count - ' + arrRoutingKeys[routingKeyIndex].lastLoopingCount, objLogInfo);
                    if (arrRoutingKeys[routingKeyIndex].lastLoopingCount > arrRoutingKeys[routingKeyIndex].maxLoopingCount) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Looping Count Exceeds the Maximum Looping Count...So Resetting the ISDONE to True', objLogInfo);
                        arrRoutingKeys[routingKeyIndex].isDone = true;
                        arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                    }
                }
            });
            //task.stop(); //this stops scheduler 
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0001', 'Catch Error in cron.schedule() While adding a New CRON Job...', error);
        }
    });
    tasks.push(task);
    return callback('started');
}
// To Verify and Restart the Service Based on the processed msg Count and Maximum Processing Msg Count
// Temporary Code For Memory Leak
function CheckProcessedMsgCountAndRestart(params, objLogInfo, CheckProcessedMsgCountAndRestartCB) {
    try {
        var isAllThreadProcessCompleted = true;
        for (let g = 0; g < arrRoutingKeys.length; g++) {
            const element = arrRoutingKeys[g];
            // Checking whether all thread processes are completed
            if (!element.isDone) {
                // Process Not Completed
                isAllThreadProcessCompleted = false;
            }
        }
        if (isAllThreadProcessCompleted) {
            reqInstanceHelper.PrintInfo(serviceName, 'Going to Restart the Service...', objLogInfo);
            reqLogWriter.EventUpdate(objLogInfo);
            reqInstanceHelper.restartSvc(objLogInfo);
        } else {
            reqInstanceHelper.PrintInfo(serviceName, 'Process is Not Completed in some other thread, so waiting to complete the remaining process', objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'Thread Informations - ' + JSON.stringify(arrRoutingKeys), objLogInfo);
            reqLogWriter.EventUpdate(objLogInfo);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_00014', 'Catch Error in CheckProcessedMsgCountAndRestart() Callback...', error);
        reqLogWriter.EventUpdate(objLogInfo);
        CheckProcessedMsgCountAndRestartCB(error, null);
    }
}
// Get data from hst_atmt_data and produce to kafka/solr and then delete it from hst table
function doPrctProduce(pHeaders, objLogInfo, routingkeyIndex, currentRoutingKey, callback) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (serviceModel) {
            reqTranDBInstance.LoadTranDBClient(serviceModel);
        }
        pHeaders.LOG_INFO = objLogInfo;
        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            try {
                var arrId = [];
                reqAsync.series({
                    ProcessHistoryTable: function (ProcessHistoryTableCB) {
                        reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Checking PRCT Data', objLogInfo);
                        getHistoryTableValues(pHeaders, pSession, objLogInfo, function (result) {
                            try {
                                var arrRows = reqInstanceHelper.ArrKeyToUpperCase(result);
                                var i = 0;

                                function next() {
                                    i++;
                                    if (i < arrRows.length) {
                                        doProduce(arrRows[i][historyTableKeyColumn], arrRows[i].PROCESS_INFO || arrRows[i]);
                                    } else {
                                        ProcessHistoryTableCB();
                                    }
                                }
                                if (arrRows && arrRows.length) {
                                    doProduce(arrRows[i][historyTableKeyColumn], arrRows[i].PROCESS_INFO || arrRows[i]);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - No Data Found', objLogInfo);
                                    ProcessHistoryTableCB();
                                }

                                function doProduce(hstTblId, newData) {
                                    // PROCESS_INFO
                                    var json = (typeof newData == 'string' && JSON.parse(newData)) || newData;
                                    if (json.IS_PROCESSED == null || json.IS_PROCESSED == '') {
                                        delete json.IS_PROCESSED;
                                    }
                                    if (json.LOCK_ID) {
                                        delete json.LOCK_ID;
                                    }
                                    if (json.CREATED_DATE) {
                                        json.CREATED_DATE = new Date(json.CREATED_DATE).toISOString(); // Directly To solr PRCT Core Via Kafka Topic
                                    }
                                    reqProducer.ProduceMessage('PRC_TOKENS', json, pHeaders, function (res) {
                                        try {
                                            if (res == 'SUCCESS') {
                                                arrRoutingKeys[routingkeyIndex].maxPrctdataproducerProcessCount = arrRoutingKeys[routingkeyIndex].maxPrctdataproducerProcessCount + 1;
                                                arrId.push(hstTblId);

                                            } else {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0006', 'Error in ProduceMessage() Callback...', 'Response is FAILURE...');
                                            }
                                            next();
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0005', 'Catch Error in ProduceMessage() Callback...', error);
                                            next();
                                        }
                                    });

                                }
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0004', currentRoutingKey + ' - Catch Error in getHistoryTableValues() Callback...', error);
                                ProcessHistoryTableCB();
                            }
                        });
                    }

                    , UpdateHistory: function (UpdateHistoryCB) {
                        try {
                            // deleteFromTable = true;
                            if (!deleteFromTable) {
                                if (arrId.length) {
                                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Update Count - ' + arrId.length, objLogInfo);
                                    var condObj = {
                                        'PRCT_ID': arrId
                                    };
                                    var updateObj = {
                                        'PROCESS_COUNT': 1,
                                        'LOCK_ID': null,
                                        'MODIFIED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                    };
                                    reqTranDBInstance.UpdateTranDB(pSession, HistoryTable, updateObj, condObj, objLogInfo, function (pResult, pError) {
                                        if (pError) {
                                            CreateDBUpdateRecoveryLog(condObj, updateObj, pError, pHeaders, function (result) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_00015', currentRoutingKey + ' - Error while updating a record from table ...', pError);
                                                arrId = [];
                                                UpdateHistoryCB();
                                            });
                                        } else {
                                            arrId = [];
                                            UpdateHistoryCB();
                                        }
                                    }
                                    );
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - There is No Eligible Data For Update Process - ', objLogInfo);
                                    UpdateHistoryCB(null, 'SUCCESS');
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Skipping The Update Process because Delete From Table is Enabled ', objLogInfo);
                                UpdateHistoryCB(null, 'SUCCESS');
                            }
                        } catch (ex) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_00016', currentRoutingKey + ' - Catch Error in UpdateHistory() ...', ex);
                            UpdateHistoryCB(ex, null);
                        }
                    }
                    , DeleteHistory: function (DeleteHistoryCB) {
                        try {
                            // deleteFromTable = false; // @@@
                            if (deleteFromTable) {
                                if (arrId.length) {
                                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Delete Count - ' + arrId.length, objLogInfo);
                                    var condObj = {
                                        'PRCT_ID': arrId
                                    };
                                    reqTranDBInstance.DeleteTranDB(pSession, HistoryTable, condObj, objLogInfo, function (pResult, pError) {
                                        if (pError) {
                                            CreateDBDeleteRecoveryLog(condObj, pError, pHeaders, function (result) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_00017', currentRoutingKey + ' - Error while deleting a record from table ...', pError);
                                                arrId = [];
                                                DeleteHistoryCB();
                                            });
                                        } else {
                                            arrId = [];
                                            DeleteHistoryCB();
                                        }
                                    }
                                    );
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - There is No Eligible Data For Delete Process - ', objLogInfo);
                                    DeleteHistoryCB(null, 'SUCCESS');
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Delete From Table is Not Enabled - ', objLogInfo);
                                DeleteHistoryCB(null, 'SUCCESS');
                            }
                        } catch (ex) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_00018', currentRoutingKey + ' - Catch Error in DeleteHistory() ...', ex);
                            DeleteHistoryCB(ex, null);
                        }
                    }

                    , HandlingOldLockIDs: function (HandlingOldLockIDsCB) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Checking Old LockIDs', objLogInfo);
                            var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                            var cond = ' AND LOCK_ID IS NOT NULL';
                            var handlingOldLockIDDataQry = "select PRCT_ID from " + HistoryTable + " WHERE MODIFIED_DATE <= cast('" + modifiedDate + "' as timestamp) - INTERVAL '" + lockIDExpiringDuration + "' HOUR " + cond;
                            if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                                handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' AND ROWNUM <= ' + HistoryTableQueryCount;
                            } else {
                                handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' LIMIT ' + HistoryTableQueryCount;
                            }
                            var handlingOldLockIDDataUpdateQry = "UPDATE " + HistoryTable + " SET LOCK_ID = NULL, MODIFIED_DATE = '" + modifiedDate + "', COMMENTS = 'Making Old Lock IDs to NULL' WHERE PRCT_ID IN (" + handlingOldLockIDDataQry + ") AND PROCESS_COUNT IS NULL and LOCK_ID IS NOT NULL";
                            reqTranDBInstance.ExecuteSQLQuery(pSession, handlingOldLockIDDataUpdateQry, objLogInfo, function (result, error) {
                                if (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0012', currentRoutingKey + ' - Error While Executing handlingOldLockIDDataQry in ExecuteSQLQuery()...', error);
                                }
                                reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Checking Old LockIDs Process Completed', objLogInfo);
                                HandlingOldLockIDsCB();
                            });

                        } catch (ex) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0013', currentRoutingKey + ' - Catch Error in Async Series DeleteHistory();...', error);
                            HandlingOldLockIDsCB(ex, null);
                        }
                    }
                },
                    function (err, results) {
                        // Closing The Connection 
                        reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - PRCT Data Process Completed', objLogInfo);
                        reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function (params) {
                            callback();
                        });
                    });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0003', currentRoutingKey + ' - Catch Error in GetTranDBConn() Callback...', error);
                callback();
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0002', 'Catch Error in doPrctProduce()...', error);
        callback();
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


// To query the HST_ATMT_DATA table data with limit 100
function getHistoryTableValues(pHeaders, pSession, objLogInfo, callback) {
    try {
        var cond = " process_count IS NULL and lock_id IS NULL ";
        var strSelQuery = 'SELECT ' + historyTableKeyColumn + ' FROM ' + HistoryTable + ' WHERE ' + cond + ' LIMIT ' + HistoryTableQueryCount;
        if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
            strSelQuery = 'SELECT ' + historyTableKeyColumn + ' FROM ' + HistoryTable + ' WHERE ' + cond + ' AND ROWNUM <= ' + HistoryTableQueryCount;
        }
        var lock_id = reqUuid();
        var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
        var hst_tran_data_prct_update_qry = "update " + HistoryTable + " set lock_id = '" + lock_id + "', MODIFIED_DATE = '" + modifiedDate + "' WHERE " + historyTableKeyColumn + " IN (" + strSelQuery + ") and lock_id IS NULL";
        var select_after_update_qry = "select * from " + HistoryTable + " where lock_id = '" + lock_id + "'";

        reqTranDBInstance.ExecuteSQLQuery(pSession, hst_tran_data_prct_update_qry, objLogInfo, function (result, error) {
            try {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0009', 'Error While Executing hst_tran_data_prct_update_qry in ExecuteSQLQuery()...', error);
                    callback([]);
                } else {
                    // select_after_update_qry = 'select * from PRC_TOKENS  where prct_id = 6538495';
                    reqTranDBInstance.ExecuteSQLQuery(pSession, select_after_update_qry, objLogInfo, function (result, error) {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0011', 'Error While Executing select_after_update_qry in ExecuteSQLQuery()...', error);
                            callback([]);
                        } else {
                            callback(result.rows);
                        }
                    });
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0008', 'Catch Error in ExecuteSQLQuery() Callback...', error);
                callback([]);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_PRODUCER_WORKER_0007', 'Catch Error in getHistoryTableValues()...', error);
        callback([]);
    }
}

module.exports = {
    ProduceWithTranDBKey: ProduceWithTranDBKey
}
/******** End of File **********/