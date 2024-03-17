/*
Modified By UdhayRaj Ms on 25-10-2016 for assign more than one user at a time.

/*@Api_Name : /InviteUser,
@Description: To InviteUser
@Last_Error_code:
*/


// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDateFromater = require('../../../../torus-references/common/dateconverter/DateFormatter')

const TOTALAPP_USERS = "update fx_total_items set counter_value = counter_value + 1 where code='APP_USERS'";
const APPUSERSRW = 'select u_id from app_users where u_id in ? and app_id=?';
const INSAPPUSERSRW = 'insert into app_users(u_id,app_id,appu_id,created_by,created_date) values(?,?,?,?,?)';
const APPU_count = 'select counter_value from fx_total_items where code=?';

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');


//global variable Initialization
var strServiceName = 'InviteUser';

// Host the method to express
router.post('/InviteUser', function(appRequest, appResponse) {
    var objLogInfo;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service TOTALAPPSTS table', objLogInfo);
            objLogInfo.HANDLER_CODE = 'InviteUser';
            objLogInfo.PROCESS = 'InviteUser-MiniGoverner';
            objLogInfo.ACTION_DESC = 'InviteUser';
            var mHeaders = appRequest.headers;

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra Connection Initiated Successfully', objLogInfo);
                var mCltClient = pCltClient;
                reqInstanceHelper.PrintInfo(strServiceName, 'cas info is ' + mCltClient.keyspace, objLogInfo);
                appResponse.setHeader('Content-Type', 'application/json');
                var lstU_id = appRequest.body.PARAMS.PU_ID;
                lstU_id = lstU_id.split(',');
                var UIDCount = lstU_id.length;
                var pClient_id = sessionInfo.CLIENT_ID;
                var pApp_id = sessionInfo.APP_ID;
                var pUserId = sessionInfo.U_ID;
                var UNIQ_APPU_ID = '';
                var uid = [];
                var k = 0;
                var counter_value = 0;
                reqInstanceHelper.PrintInfo(strServiceName, 'Calling InviteUser function', objLogInfo);
                GetInviteUser();

                //Preapre invite user
                function GetInviteUser() {
                    reqInstanceHelper.PrintInfo(strServiceName, 'GetInviteUser function executing', objLogInfo);
                    try {
                        uid = lstU_id;
                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_users table', objLogInfo);
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_users', ['u_id'], {
                            'u_id': uid,
                            'app_id': pApp_id
                        }, objLogInfo, function callbackappu(err, result) {
                            try {
                                if (err) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50801', ' Querying app_users table have been failed', error, '', '');
                                } else {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Calling GetAppuInfo function ', objLogInfo);
                                    GetAppuInfo(uid);
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50802', 'Error in receiving callback from app_users', error, '', '');
                                //errorHandler("ERR-FX-10302", "Error in InviteUser function " + error)
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50803', 'Error in calling GetInviteUser function', error, '', '');

                        //errorHandler("ERR-FX-10301", "Error in InviteUser function " + error)
                    }
                }

                //Prepare Application update and insert info
                function GetAppuInfo(uid) {
                    reqInstanceHelper.PrintInfo(strServiceName, 'GetAppuInfo function executing', objLogInfo);
                    //reqLogWriter.TraceInfo(objLogInfo, 'GetAppuInfo function executing...')
                    try {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying TOTALAPP_USERS table', objLogInfo);
                        //reqLogWriter.TraceInfo(objLogInfo, 'Update fx_total_items query executing...')
                        reqFXDBInstance.ExecuteQuery(mCltClient, TOTALAPP_USERS, objLogInfo, function callbacktotappu(err) {
                            try {
                                if (err) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50804', 'Error while querying TOTALAPP_USERS table', err, '', '');
                                    //reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10302");
                                } else {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table on the success of TOTALAPP_USERS table result', objLogInfo);
                                    //reqLogWriter.TraceInfo(objLogInfo, 'Update fx_total_items success, select fx_total_items query executing...')
                                    reqFXDBInstance.GetTableFromFXDB(mCltClient, 'fx_total_items', ['counter_value'], {
                                        'code': 'APP_USERS'
                                    }, objLogInfo, function callbackappuct(err, res) {
                                        try {
                                            if (err) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50805', 'Error while querying fx_total_items table', error, '', '');
                                                //reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10302");
                                            } else {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                var ctrval = res.rows;
                                                UNIQ_APPU_ID = ctrval[0].counter_value.toString();
                                                reqInstanceHelper.PrintInfo(strServiceName, 'lstU_id[i]' + uid, objLogInfo);
                                                //reqLogWriter.TraceInfo(objLogInfo, 'lstU_id[i]' + uid);
                                                //uid is array, array value shifted,and set the paramete to  _appuserinsert function
                                                _appuserinsert(uid.shift())
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50806', 'Error in receiving callback from fx_total_items table', error, '', '');
                                            //errorHandler("ERR-FX-10298", "Error in InviteUser function " + error)
                                        }
                                    })
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50807', 'Error in executing TOTALAPP_USERS table', error, '', '');
                                //errorHandler("ERR-FX-10298", "Error in InviteUser function " + error)
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50808', 'Error in calling GetAppuInfo function', error, '', '');
                        //errorHandler("ERR-FX-10297", "Error in InviteUser function " + error)
                    }
                }
                //appuser insert function 
                function _appuserinsert(shifteduid) {
                    try {
                        reqInstanceHelper.PrintInfo(strServiceName, '_appuserinsert function executing..., Insert into appuser query executing', objLogInfo);
                        //reqLogWriter.TraceInfo(objLogInfo, '_appuserinsert function executing..., Insert into appuser query executing')
                        //appuser innsert query 
                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_users table', objLogInfo);
                        reqFXDBInstance.InsertFXDB(mCltClient, 'app_users', [{
                            'u_id': shifteduid,
                            'app_id': pApp_id,
                            'appu_id': UNIQ_APPU_ID,
                            'created_by': pUserId,
                            'created_date': reqDateFromater.GetTenantCurrentDateTime(mHeaders, objLogInfo)
                        }], objLogInfo, function callbackinsappu(err) {
                            try {
                                if (err) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50809', 'Error in executing app_users table', err, '', '');
                                    //reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10302");

                                } else {
                                    k = k + 1;
                                    if (k == UIDCount) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', 'SUCCESS', '');
                                        //appResponse.write(JSON.stringify('SUCCESS'));
                                        //reqLogWriter.EventUpdate(objLogInfo);
                                        //appResponse.end();
                                    } else {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Total UIDCount is' + UIDCount + ' not equal to loop' + k + ',loop continue', objLogInfo);
                                        //reqLogWriter.TraceInfo(objLogInfo, 'Total UIDCount is' + UIDCount + ' not equal to loop' + k + ',loop continue');
                                        GetAppuInfo(uid)
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50810', 'Error in receiving callback from app_users table', error, '', '');
                                //errorHandler("ERR-FX-10300", "Error in InviteUser function " + error)
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50811', 'Error in calling _appuserinsert function', error, '', '');
                        //errorHandler("ERR-FX-10297", "Error in InviteUser function " + error)
                    }
                }

            });
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50812', 'Error in calling InviteUser function', error, '', '');
        //errorHandler("ERR-FX-10296", "Error in InviteUser function " + error)
    }

    appResponse.on('close', function() {});
    appResponse.on('finish', function() {});
    appResponse.on('end', function() {});

});
module.exports = router;
/*********** End of Service **********/