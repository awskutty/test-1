/****
   @Descriptions     :  Child process to insert the trna_data details to solr/kafka from hst_atmt_data table
                        For Ultimate - Produce data to kafka
                        For Lite     - Insert data to solr 
   @Last_Error_Code  :  ERR-ATMT-PRODUCER-0018
 ****/

// Require dependencies
var cron = require('node-cron');
var reqAsync = require('async');
var reqUuid = require('uuid');
var reqOs = require('os');
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');

// Global variable initialization
var serviceName = 'AtmtDataProducerWorker';
var containerName = reqOs.hostname();
var maxMemorySize = 300; // In MB
var HistoryTable = 'HST_TRN_ATTACHMENTS';
var HistoryTableQueryCount = 500;
var deleteFromTable = true;
var task = null;
var restartFlag = false;
var replaceSpecialChar = '';
var lockIDExpiringDuration = '1';
var tasks = [];
var arrRoutingKeys = [];


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

    reqInstanceHelper.PrintInfo(serviceName, 'Creating new cron job for current key', {});
    task = cron.schedule('*/10 * * * * *', function () {
        try {
            var currentRoutingKey = headers.routingkey;
            var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == headers.routingkey);

            var objLogInfo = arrRoutingKeys[routingKeyIndex].objLogInfo; // Assiging unique Loginfo for Each Routing Key
            reqInstanceHelper.PrintInfo(serviceName, 'Current Rounting Key - ' + currentRoutingKey, objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'TimeZone Info - ' + JSON.stringify(objLogInfo.TIMEZONE_INFO), objLogInfo);
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
                        var startTime = new Date().toLocaleString();
                        reqInstanceHelper.PrintInfo(serviceName, 'Routing Key - ' + currentRoutingKey + ' and Thread Start Time - ' + startTime, objLogInfo);
                        doAtmtProduce(headers, objLogInfo, function () {
                            reqInstanceHelper.PrintInfo(serviceName, 'Routing Key - ' + currentRoutingKey + ' and Thread Start Time - ' + startTime, objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'Routing Key - ' + currentRoutingKey + ' and Thread End Time - ' + new Date().toLocaleString(), objLogInfo);
                            reqLogWriter.EventUpdate(objLogInfo);
                            arrRoutingKeys[routingKeyIndex].isDone = true;
                            arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                        });
                    } else {
                        // Going to Restart the Service
                        CheckProcessedMsgCountAndRestart(objLogInfo, function (params) { })
                    }
                }
                else {
                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' Already a cron thread is processing. So skiping this cron thread.  IsDone = ' + arrRoutingKeys[routingKeyIndex].isDone, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Last Looping Count - ' + arrRoutingKeys[routingKeyIndex].lastLoopingCount, objLogInfo);
                    if (arrRoutingKeys[routingKeyIndex].lastLoopingCount > arrRoutingKeys[routingKeyIndex].maxLoopingCount) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Looping Count Exceeds the Maximum Looping Count...So Resetting the ISDONE to True', objLogInfo);
                        reqLogWriter.EventUpdate(objLogInfo);
                        arrRoutingKeys[routingKeyIndex].isDone = true;
                        arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                    }
                }
            })
            //task.stop(); //this stops scheduler 
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0001', 'Catch Error in cron.schedule() While adding a New CRON Job...', error);
        }
    });
    tasks.push(task);
    return callback('started');
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


// Get data from hst_atmt_data and produce to kafka/solr and then delete it from hst table
function doAtmtProduce(pHeaders, objLogInfo, doAtmtProduceCB) {
    try {
        var processedData = [];
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (serviceModel) {
            reqTranDBInstance.LoadTranDBClient(serviceModel);
        }
        // Getting the TranDb Connection
        pHeaders.LOG_INFO = objLogInfo;
        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            try {
                reqAsync.series({
                    ProcessHistoryTable: function (ProcessHistoryTableCB) {
                        try {
                            getHistoryTableValues(pHeaders, pSession, objLogInfo, function (result) {
                                var result = reqInstanceHelper.ArrKeyToLowerCase(result);
                                var topicName = '';
                                if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                                    topicName = 'PRF.HST_TRN_ATTACHMENTS';
                                } else {
                                    topicName = 'PRF.hst_trn_attachments';
                                }
                                if (objLogInfo.IS_TENANT_MULTI_THREADED) {
                                    topicName = topicName + '_' + pHeaders.routingkey;
                                }
                                topicName = topicName.replace(/~/g, '_'); // If Replace is Not Done then It will not create a Kfka Topic
                                reqInstanceHelper.PrintInfo(serviceName, 'Topic Name | ' + topicName, objLogInfo);
                                var pResultRows = [];
                                pResultRows = new reqLinq(result)
                                    .OrderBy(function (row) {
                                        return row.hta_id; // Filtering the Rows based on hta_id
                                    })
                                    .ToArray();
                                if (pResultRows.length) {
                                    reqAsync.forEachOfSeries(pResultRows, function (trn_atmt_row, i, trn_atmt_row_processed) {
                                        if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                                            // To verify the New and old data json value for special characters
                                            if (trn_atmt_row.new_data_json) {
                                                trn_atmt_row.new_data_json = reqInstanceHelper.ReplaceSpecialCharacter(trn_atmt_row.new_data_json, replaceSpecialChar.split(','));
                                            }

                                            // To verify the old data json value for special characters
                                            if (trn_atmt_row.old_data_json) {
                                                trn_atmt_row.old_data_json = reqInstanceHelper.ReplaceSpecialCharacter(trn_atmt_row.old_data_json, replaceSpecialChar.split(','));
                                            }
                                        }
                                        var kafkaTopicData = { HST_DATA: trn_atmt_row, ROUTING_KEY: pHeaders.routingkey };
                                        reqProducer.ProduceMessage(topicName, kafkaTopicData, pHeaders, function (res) {
                                            try {
                                                if (res == 'SUCCESS') {
                                                    processedData.push(trn_atmt_row.hta_id); // Colletcing the Successfully Processed Data
                                                }
                                                trn_atmt_row_processed();
                                            } catch (error) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0005', 'Catch Error in ProduceMessage() Callback...', error);
                                                trn_atmt_row_processed();
                                            }
                                        });
                                    }, ProcessHistoryTableCB);
                                } else {
                                    ProcessHistoryTableCB();
                                }
                            });
                        }
                        catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0014', 'Catch Error in Async Series ProcessHistoryTable();...', error);
                            ProcessHistoryTableCB();
                        }
                    },
                    UpdateHistory: function (UpdateHistoryCB) {
                        try {
                            // deleteFromTable = true; // @@@
                            if (!deleteFromTable) { // Length Should Not Exceeding 999, if exceeds, it will throw error
                                if (processedData.length) { // Length Should Not Exceeding 999, if exceeds, it will throw error
                                    reqInstanceHelper.PrintInfo(serviceName, 'Processed Data Count | ' + processedData.length, objLogInfo);
                                    reqTranDBInstance.UpdateTranDB(pSession, HistoryTable, {
                                        'PROCESS_COUNT': 1,
                                        'LOCK_ID': null,
                                        'MODIFIED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                    }, {
                                        'HTA_ID': processedData
                                    }, objLogInfo, function (pResult, error) {
                                        if (error) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Processed Data - ' + processedData.toString(), objLogInfo);
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0013', 'Error While Updating the Processed Data', error);
                                        }
                                        processedData = [];
                                        UpdateHistoryCB();
                                    }
                                    );
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'There is No Eligible Data For Delete Process', objLogInfo);
                                    UpdateHistoryCB();
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Skipping The Update Process because Delete From Table is Enabled', objLogInfo);
                                UpdateHistoryCB();
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0012', 'Catch Error in Async Series DeleteHistory();...', error);
                            UpdateHistoryCB();
                        }
                    },
                    DeleteHistory: function (DeleteHistoryCB) {
                        try {
                            // deleteFromTable = false; // @@@
                            if (deleteFromTable) {
                                if (processedData.length) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Delete  Count | ' + processedData.length, objLogInfo);
                                    reqTranDBInstance.DeleteTranDB(pSession, HistoryTable, {
                                        'HTA_ID': processedData
                                    }, objLogInfo, function (pResult, pError) {
                                        if (pError) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Processed Data - ' + processedData.toString(), objLogInfo);
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0016', 'Error While Deleting the Processed Data', pError);
                                        }
                                        processedData = [];
                                        DeleteHistoryCB(pError, pResult);
                                    }
                                    );
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'There is No Eligible Data For Delete Process', objLogInfo);
                                    DeleteHistoryCB(null, 'SUCCESS');
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Delete From Table is Not Enabled', objLogInfo);
                                DeleteHistoryCB(null, 'SUCCESS');
                            }
                        } catch (ex) {
                            DeleteHistoryCB(ex, null);
                        }
                    }
                    , HandlingOldLockIDs: function (HandlingOldLockIDsCB) {
                        try {
                            // return HandlingOldLockIDsCB();
                            var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                            var cond = ' AND LOCK_ID IS NOT NULL';
                            var handlingOldLockIDDataQry = "select HTA_ID from " + HistoryTable + " WHERE MODIFIED_DATE <= cast('" + modifiedDate + "' as timestamp) - INTERVAL '" + lockIDExpiringDuration + "' HOUR " + cond;
                            if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                                handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' AND ROWNUM <= ' + HistoryTableQueryCount;
                            } else {
                                handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' LIMIT ' + HistoryTableQueryCount;
                            }
                            var handlingOldLockIDDataUpdateQry = "UPDATE " + HistoryTable + " SET LOCK_ID = NULL, MODIFIED_DATE = '" + modifiedDate + "', COMMENTS = 'Making Old Lock IDs to NULL' WHERE HTA_ID IN (" + handlingOldLockIDDataQry + ") AND PROCESS_COUNT IS NULL and LOCK_ID IS NOT NULL";
                            reqTranDBInstance.ExecuteSQLQuery(pSession, handlingOldLockIDDataUpdateQry, objLogInfo, function (result, error) {
                                if (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0017', 'Error While Executing handlingOldLockIDDataQry in ExecuteSQLQuery()...', error);
                                }
                                HandlingOldLockIDsCB();
                            });

                        } catch (ex) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0018', 'Catch Error in Async Series DeleteHistory();...', error);
                            HandlingOldLockIDsCB(ex, null);
                        }
                    }
                },
                    function (err, results) {
                        // closing the Created Trand DB Connections
                        reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function () {
                            doAtmtProduceCB();
                        });
                    });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0003', 'Catch Error in GetTranDBConn() Callback...', error);
                doAtmtProduceCB();
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0002', 'Catch Error in doPrctProduce()...', error);
        doAtmtProduceCB();
    }
}

// To query the HST_TRN_ATTACHMENTS table data with limit 100
function getHistoryTableValues(pHeaders, pSession, objLogInfo, callback) {
    try {
        var HistoryTable = 'HST_TRN_ATTACHMENTS';
        var cond = " process_count IS NULL and lock_id IS NULL and UPPER(routingkey) = UPPER('" + pHeaders.routingkey + "') ";
        var strSelQuery = 'SELECT HTA_ID FROM (SELECT HTA_ID FROM ' + HistoryTable + ' WHERE ' + cond + ' ORDER BY HTA_ID ASC) T  LIMIT ' + HistoryTableQueryCount;
        if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
            strSelQuery = 'SELECT HTA_ID FROM (SELECT HTA_ID FROM ' + HistoryTable + ' WHERE ' + cond + ' ORDER BY HTA_ID ASC) T  WHERE ROWNUM <= ' + HistoryTableQueryCount;
        }
        var lock_id = reqUuid() + '-' + containerName;
        var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
        var hst_tran_data_prct_update_qry = "update " + HistoryTable + " set lock_id = '" + lock_id + "', MODIFIED_DATE = '" + modifiedDate + "' WHERE HTA_ID IN (" + strSelQuery + ") and " + cond;
        var select_after_update_qry = "select * from " + HistoryTable + " where lock_id = '" + lock_id + "'";
        reqTranDBInstance.ExecuteSQLQuery(pSession, hst_tran_data_prct_update_qry, objLogInfo, function (result, error) {
            try {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0009', 'Error While Executing hst_tran_data_prct_update_qry in ExecuteSQLQuery()...', error);
                    callback([]);
                } else {

                    // select_after_update_qry = 'select * from HST_TRN_ATTACHMENTS  where HTA_ID = 24624105';

                    reqTranDBInstance.ExecuteSQLQuery(pSession, select_after_update_qry, objLogInfo, function (result, error) {
                        // if (1) {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0011', 'Error While Executing select_after_update_qry in ExecuteSQLQuery()...', error);
                            callback([]);
                        } else {
                            callback(result.rows);
                        }
                    });
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0008', 'Catch Error in ExecuteSQLQuery() Callback...', error);
                callback([]);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ATMT-PRODUCER-0007', 'Catch Error in getHistoryTableValues()...', error);
        callback([]);
    }
}

module.exports = {
    InitiateThread: initiateThread
}
/******** End of File **********/