var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var strServiceName = 'SaveUserGroup';
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
router.post('/SaveUserGroup', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        var pHeader = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (resObjLogInfo, sessionInfo) {
            objLogInfo = resObjLogInfo;
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_User_Group';
            reqTranDBHelper.GetTranDBConn(pHeader, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    reqInstanceHelper.PrintInfo(strServiceName, 'SaveUserGroup Service Begin', objLogInfo);
                    objLogInfo.HANDLER_CODE = 'SaveUserGroup';
                    objLogInfo.PROCESS = 'SaveUserGroup-MiniGoverner';
                    objLogInfo.ACTION_DESC = 'SaveUserGroup';
                    var params = appRequest.body.PARAMS;

                    reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                        try {
                            checkclusterexist(params)

                            function checkclusterexist(params) {
                                try {
                                    reqDBInstance.GetTableFromFXDB(DBSession, 'User_Group', [], {
                                        'code': params.CODE
                                    }, objLogInfo, function (pError, pRes) {
                                        if (pError) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured check cluster already exist ', pError, '', '');
                                        } else {
                                            if (pRes.rows.length > 0 && params.IsUpdate == 'N') {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Cluster code already exits', objLogInfo, '', '', 'FAILURE', '', '');
                                            } else if (params.IsUpdate == "N") {
                                                insertUserGroup();
                                            }
                                            else if (params.IsUpdate == "Y") {
                                                updateUserGroup();
                                            }
                                        }
                                    })
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured check clusterexist', error, '', '');
                                }
                            };

                            //insert new cluster
                            function insertUserGroup() {
                                try {

                                    var UserGrpRow = []
                                    // var AppRole = params.ROLES;
                                    // for (var i = 0; i < AppRole.length; i++) {
                                    var UserGrpobj = {};
                                    UserGrpobj.code = params.CODE;
                                    UserGrpobj.description = params.CODE;
                                    UserGrpobj.prct_id = prct_id
                                    UserGrpRow.push(UserGrpobj)
                                    // }
                                    //insert into clusters table 
                                    reqTranDBHelper.InsertTranDBWithAudit(DBSession, 'USER_GROUP', UserGrpRow, objLogInfo, function (Res, pErr) {
                                        // reqDBInstance.InsertFXDB(DBSession, 'USER_GROUP', [UserGrpRow], objLogInfo, function (pErr, Res) {
                                        if (pErr) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured insert cluster ', pErr, '', '');
                                        } else {
                                            Insertusergroupapprole(params)
                                            // reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                        }
                                    });

                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while getting new cluster id', error, '', '');
                                }
                            }

                            //Update Cluster
                            function updateUserGroup() {
                                try {
                                    var pCond = {
                                        ug_code: params.CODE
                                    }
                                    reqDBInstance.DeleteFXDB(DBSession, 'USER_GROUP_APP_ROLES', pCond, objLogInfo, function (Perr, Presult) {
                                        if (Perr) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured update cluster ', Perr, '', '');
                                        } else {
                                            // reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                            Insertusergroupapprole()
                                        }
                                    })
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured updatecluster', error, '', '');
                                }
                            }

                            function Insertusergroupapprole() {
                                try {
                                    var rolesarr = params.ROLES || [];
                                    var appRolearr = []
                                    for (var i = 0; i < rolesarr.length; i++) {
                                        var appRoleobj = {};
                                        appRoleobj.appr_id = rolesarr[i];
                                        appRoleobj.ug_code = params.CODE;
                                        appRolearr.push(appRoleobj)
                                    }
                                    if (appRolearr.length) {
                                        reqTranDBHelper.InsertTranDBWithAudit(DBSession, 'USER_GROUP_APP_ROLES', appRolearr, objLogInfo, function (Res, pErr) {
                                            try {
                                                if (pErr) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-MIN-15001', 'Error occured', pErr, '', '');
                                                } else {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                }
                                            } catch (error) {

                                            }
                                        })
                                    } else {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                    }

                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-MIN-15001', 'Exception occured', error)
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