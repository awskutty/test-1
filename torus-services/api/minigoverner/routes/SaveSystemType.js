var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'SaveSystemType';
router.post('/SaveSystemType', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'SaveCluster Service Begin', objLogInfo);
            var pHeader = appRequest.headers;
            objLogInfo.HANDLER_CODE = 'SaveSystemType';
            objLogInfo.PROCESS = 'SaveCluster-MiniGoverner';
            objLogInfo.ACTION_DESC = 'SaveSystemType';
            var params = appRequest.body.PARAMS;
            var STCode = params.ST_CODE;
            var STDesc = params.ST_DESCRIPTION;
            var ClientID = params.CLIENT_ID;
            var STID = params.ST_ID;
            reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                try {
                    if (STID != undefined) {
                        updateSystemType(STID, STDesc, ClientID);
                    } else {
                        insertSystemType(STCode, STDesc, ClientID);
                    }

                    // function checkSTExist(params) {
                    //     try {
                    //         reqDBInstance.GetTableFromFXDB(DBSession, 'system_types', [], {
                    //             'client_id': ClientID,
                    //             'st_id': STID
                    //         }, objLogInfo, function (pError, pRes) {
                    //             if (pError) {
                    //                 reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured check cluster already exist ', pError, '', '');
                    //             } else {
                    //                 if (pRes.rows.length > 0 && params.IsUpdate == 'N') {
                    //                     reqInstanceHelper.SendResponse(strServiceName, appResponse, 'ST code already exits', objLogInfo, '', '', 'FAILURE', '', '');
                    //                 } else if (params.IsUpdate == "N") {
                    //                     insertSystemType(STCode, STDesc, ClientID);
                    //                 }
                    //                 // else if (params.IsUpdate == "Y") {
                    //                 //     updateSystemType(STCode, STDesc, ClientID);
                    //                 // }
                    //             }
                    //         })
                    //     } catch (error) {
                    //         reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured check clusterexist', error, '', '');
                    //     }
                    // };

                    //insert new cluster
                    function insertSystemType(STCode, STDesc, ClientID) {
                        try {
                            const UpdateCounter = "update fx_total_items set counter_value = counter_value + 1 where code='SYSTEM_TYPES'";
                            //update fx_total_items table counter values  CLUSTER_CODE
                            reqDBInstance.ExecuteQuery(DBSession, UpdateCounter, objLogInfo, function (Err, Res) {
                                if (Err) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured increment total items ', Err, '', '');
                                }
                                else {
                                    //Get new cluster id from fx_total_items table 
                                    reqDBInstance.GetTableFromFXDB(DBSession, 'fx_total_items', [], {
                                        'code': 'SYSTEM_TYPES'
                                    }, objLogInfo, function (err, res) {
                                        try {
                                            if (err) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured get increment total items ', err, '', '');
                                            }
                                            else {
                                                var NewSTID = res.rows[0].counter_value.toString();
                                                var STRow = {};
                                                STRow.st_code = STCode;
                                                STRow.st_description = STDesc;
                                                STRow.st_id = NewSTID;
                                                STRow.client_id = ClientID;
                                                STRow.created_date = reqDateFormater.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                                STRow.created_by = objLogInfo.USER_ID;
                                                STRow.st_category = 'INTERNAL';
                                                //insert into clusters table 
                                                reqDBInstance.InsertFXDB(DBSession, 'system_types', [STRow], objLogInfo, function (pErr, Res) {
                                                    if (pErr) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured insert cluster ', pErr, '', '');
                                                    }
                                                    else {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                    }
                                                });
                                            }
                                        }
                                        catch (error) {
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
                    function updateSystemType(STID, STDesc, ClientID) {
                        try {
                            var STUpdateRow = {}
                            STUpdateRow.modified_by = objLogInfo.USER_ID;
                            STUpdateRow.modified_date = reqDateFormater.GetTenantCurrentDateTime(pHeader, objLogInfo);
                            STUpdateRow.st_description = STDesc;
                            var STUpdatecond = {};
                            STUpdatecond.st_id = STID;
                            STUpdatecond.client_id = ClientID
                            reqDBInstance.UpdateFXDB(DBSession, 'system_types', STUpdateRow, STUpdatecond, objLogInfo, function (Perr, Presult) {
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
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while SaveCluster function ', error, '', '');
    }
});
module.exports = router;


