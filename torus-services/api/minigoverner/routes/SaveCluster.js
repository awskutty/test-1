var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var strServiceName = 'SaveCluster';
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
router.post('/SaveCluster', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        var pHeader = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_Cluster';
            reqTranDBHelper.GetTranDBConn(pHeader, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    reqInstanceHelper.PrintInfo(strServiceName, 'SaveCluster Service Begin', objLogInfo);
                    objLogInfo.HANDLER_CODE = 'SaveCluster';
                    objLogInfo.PROCESS = 'SaveCluster-MiniGoverner';
                    objLogInfo.ACTION_DESC = 'SaveCluster';
                    var params = appRequest.body.PARAMS;
                    var ClusterCode = params.CLUSTER_CODE;
                    var ClusterDesc = params.CLUSTER_DESCRIPTION;
                    var ClientID = params.CLIENT_ID;
                    var strTntId = sessionInfo.TENANT_ID;
                    reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                        try {
                            checkclusterexist(params)

                            function checkclusterexist(params) {
                                try {
                                    reqDBInstance.GetTableFromFXDB(DBSession, 'clusters', [], {
                                        'cluster_code': ClusterCode
                                    }, objLogInfo, function (pError, pRes) {
                                        if (pError) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured check cluster already exist ', pError, '', '');
                                        } else {
                                            if (pRes.rows.length > 0 && params.IsUpdate == 'N') {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Cluster code already exits', objLogInfo, '', '', 'FAILURE', '', '');
                                            } else if (params.IsUpdate == "N") {
                                                insertcluster(ClusterCode, ClusterDesc, ClientID);
                                            } else if (params.IsUpdate == "Y") {
                                                updatecluster(ClusterCode, ClusterDesc, ClientID);
                                            }
                                        }
                                    })
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured check clusterexist', error, '', '');
                                }
                            };

                            //insert new cluster
                            function insertcluster(ClusterCode, ClusterDesc, ClientID) {
                                try {
                                    const UpdateCounter = "update fx_total_items set counter_value = counter_value + 1 where code='CLUSTERS'";
                                    //update fx_total_items table counter values  CLUSTER_CODE
                                    reqDBInstance.ExecuteQuery(DBSession, UpdateCounter, objLogInfo, function (Err, Res) {
                                        if (Err) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured increment total items ', Err, '', '');
                                        } else {
                                            //Get new cluster id from fx_total_items table 
                                            reqDBInstance.GetTableFromFXDB(DBSession, 'fx_total_items', [], {
                                                'code': 'CLUSTERS'
                                            }, objLogInfo, function (err, res) {
                                                try {
                                                    if (err) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured get increment total items ', err, '', '');
                                                    } else {
                                                        var NewClusterID = res.rows[0].counter_value.toString();
                                                        var ClusterRow = {};
                                                        ClusterRow.cluster_code = ClusterCode;
                                                        ClusterRow.cluster_name = ClusterDesc;
                                                        ClusterRow.cluster_id = NewClusterID;
                                                        ClusterRow.client_id = ClientID;
                                                        ClusterRow.created_date = reqDateFormater.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                                        ClusterRow.created_by = objLogInfo.USER_ID;
                                                        ClusterRow.prct_id = prct_id;
                                                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                                            ClusterRow['tenant_id'] = strTntId
                                                        }
                                                        //insert into clusters table 
                                                        reqDBInstance.InsertFXDB(DBSession, 'clusters', [ClusterRow], objLogInfo, function (pErr, Res) {
                                                            if (pErr) {
                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured insert cluster ', pErr, '', '');
                                                            } else {
                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                            }
                                                        });
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while getting new cluster id', error, '', '');
                                                }
                                            });
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while insertcluster ', error, '', '');
                                }
                            }

                            //Update Cluster
                            function updatecluster(ClusterCode, ClusterDesc, ClientID) {
                                try {
                                    var ClusterupdateRow = {}
                                    ClusterupdateRow.modified_by = objLogInfo.USER_ID;
                                    ClusterupdateRow.modified_date = reqDateFormater.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                    ClusterupdateRow.cluster_name = ClusterDesc;
                                    ClusterupdateRow.prct_id = prct_id;
                                    var Clusterupdatecond = {};
                                    Clusterupdatecond.cluster_code = ClusterCode;
                                    Clusterupdatecond.client_id = ClientID
                                    reqDBInstance.UpdateFXDB(DBSession, 'clusters', ClusterupdateRow, Clusterupdatecond, objLogInfo, function (Perr, Presult) {
                                        if (Perr) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured update cluster ', Perr, '', '');
                                        } else {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                        }
                                    })
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured updatecluster', error, '', '');
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while connecting DB GetFXDBConnection', error, '', '');
                        }
                    });
                });
            });
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while SaveCluster function ', error, '', '');
    }
});
module.exports = router;