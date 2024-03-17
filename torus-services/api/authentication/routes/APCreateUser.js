/*  Created BY      :Udhaya
    Created Date    :22-jun-2016
    Purpose         :AP create new user
    */
// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
//var reqMoment = require('moment');

var objLogInfo = '';
// Cassandra initialization
// var mClient = reqCasInstance.SessionValues['plt_cas'];

var strMessage = "";
//Update fx_total_items items
const TOTALUSERS = "update fx_total_items set counter_value = counter_value + 1 where code='USERS'";
//uodate old user query
const UPDATEUSERS = 'update users set first_name=?,middle_name=?,last_name=?,email_id=?,allocated_ip=?,double_authentication=?,double_authentication_model=?,water_marking=?,session_timeout=?,modified_by=?,modified_date=?,role=?,mobile_no=? where u_id=? and login_name = ?';
//get the login_name to check already exist
const SELECTUSER = 'Select login_name FROM users where login_name=?';

const SEL_COUNTER_VALUE = "select counter_value from fx_total_items where code='USERS'";
const INS_USERS = "insert into users(u_id,first_name,middle_name,last_name,login_name,email_id,allocated_ip,login_password,double_authentication,double_authentication_model,session_timeout,created_by,mobile_no,created_date,role)values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);"

router.post('/APCreateUser', function (req, resp) {

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'APCreateUser-Authentication';
    objLogInfo.ACTION = 'APCreateUser';
    try {
        var strUserDetails = req.body.USER_PARAMS;
        var strAppId = req.body.APP_ID;
        var strClientId = req.body.PCLIENT_ID;
        var strUserid = req.body.USER_ID;
        var strResult = '';
        var strInputParamJson = req.body;


        //function call
        APCreateUser();

        //prepare function
        function APCreateUser() {
            try {
                reqDBInstance.GetFXDBConnection(req.headers, 'plt_cas', objLogInfo, function (mClient) {
                    if (strUserDetails.U_ID == '') {

                        reqDBInstance.GetTableFromFXDB(mClient, 'USERS', ['login_name'], {
                            'login_name': strUserDetails.LOGIN_NAME.toUpperCase()
                        }, objLogInfo, function (err, lresult) {
                            try {
                                if (err)
                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10020");

                                else {
                                    // Find the user if already exist or not
                                    if (lresult.rows.length > 0) {
                                        strMessage = 'User already exist,Please create a new Login name';
                                        reqLogWriter.TraceError(objLogInfo, strMessage, "ERR-FX-00001");
                                        reqLogWriter.EventUpdate(objLogInfo);
                                        resp.send('User already exist');
                                    } else {
                                        //Call private function create new user
                                        _CreateNewUser(mClient);
                                    }
                                }
                            } catch (error) {
                                errorHandler("ERR-FX-10020", "Error APCreateUser " + error)
                            }
                        });
                    } else {
                        try {
                            // Existing user
                            console.log('Updating user id is: ' + strUserDetails.U_ID);

                            _PrepareJson(User_details.STATIC_MODULE);
                            var row = {
                                first_name: strUserDetails.FIRST_NAME,
                                middle_name: strUserDetails.MIDDLE_NAME,
                                last_name: strUserDetails.LAST_NAME,
                                email_id: strUserDetails.EMAIL_ID,
                                allocated_ip: strUserDetails.ALLOCATED_IP,
                                double_authentication: strUserDetails.DOUBLE_AUTHENTICATION,
                                double_authentication_model: strUserDetails.DOUBLE_AUTHENTICATION_MODEL,
                                water_marking: strUserDetails.NEED_WATERMARKING,
                                session_timeout: strUserDetails.SESSION_TIMEOUT,
                                modified_by: strUserid,
                                modified_date: reqDateFormater.GetTenantCurrentDateTime(req.headers, objLogInfo),
                                role: strUserDetails.APAAS_ROLES,
                                mobile_no: strUserDetails.MOBILE_NUMBER
                            };
                            var cond = {
                                u_id: strUserDetails.U_ID,
                                login_name: strUserDetails.LOGIN_NAME
                            };
                            //mClient.execute(UPDATEUSERS, [strUserDetails.FIRST_NAME, strUserDetails.MIDDLE_NAME, strUserDetails.LAST_NAME, strUserDetails.EMAIL_ID, strUserDetails.ALLOCATED_IP, strUserDetails.DOUBLE_AUTHENTICATION, strUserDetails.DOUBLE_AUTHENTICATION_MODEL, strUserDetails.NEED_WATERMARKING, strUserDetails.SESSION_TIMEOUT, strUserid, new Date(), strUserDetails.APAAS_ROLES, strUserDetails.MOBILE_NUMBER, strUserDetails.U_ID, strUserDetails.LOGIN_NAME], { prepare: true }, function callbackCreateUser(uError, uResult) {
                            reqDBInstance.UpdateFXDB(mClient, 'USERS', row, cond, objLogInfo, function callbackCreateUser(uError, uResult) {
                                try {
                                    if (uError) {
                                        strResult = uError.toString()
                                        console.log(uError);
                                    } else {
                                        strResult = 'SUCCESS';
                                        strMessage = 'User updated successfully...';
                                        reqLogWriter.TraceError(objLogInfo, strMessage);
                                        reqLogWriter.TraceInfo(objLogInfo, 'Update user Result :' + strResult);

                                    }
                                    reqLogWriter.EventUpdate(objLogInfo);
                                    resp.send('strResult');
                                } catch (error) {
                                    errorHandler("ERR-FX-10019", "Error APCreateUser " + error)
                                }
                            });
                        } catch (error) {
                            errorHandler("ERR-FX-10018", "Error APCreateUser " + error)
                        }
                    }
                });
            } catch (error) {
                errorHandler("ERR-FX-10017", "Error APCreateUser " + error)
            }
        }

        //Prepare privcate function create new user
        function _CreateNewUser(mClient) {
            try {
                //mClient.execute(TOTALUSERS, [], {prepare: true}, function callbackTOTALUSERS(err, uresult) {
                reqDBInstance.ExecuteQuery(mClient, TOTALUSERS, objLogInfo, function (err, uresult) {
                    try {
                        if (err)
                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10016");

                        else {
                            //mClient.execute("select counter_value from fx_total_items where code='USERS'", function (err, cresult) {
                                reqDBInstance.ExecuteQuery(mClient, SEL_COUNTER_VALUE, objLogInfo, function (err, uresult) {
                                if (err)
                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10016");

                                else {
                                    // get Newuser id
                                    UNIQ_U_ID = cresult.rows[0].counter_value;
                                    var orgpassword = reqEncHelper.DecryptPassword(strUserDetails.PASSWORD);
                                    var pPassword = reqEncHelper.EncryptPassword(orgpassword);
                                    _InsertUserDetail(pPassword, mClient);
                                }
                            });
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10016", "Error APCreateUser " + error)
                    }
                });
            } catch (error) {
                errorHandler("ERR-FX-10015", "Error APCreateUser " + error)

            }
            //Prepare private function insertuser detail
            function _InsertUserDetail(pPassword, mClient) {
                try {
                    //mClient.execute(INS_USERS, [, , , , , , , , , , , , , , ], {prepare: true},function caalbackInsertUser(err, pResult) {
                        var arr = [];
                            var row = new Object();
                            row.login_name = strUserDetails.LOGIN_NAME.toUpperCase();
                            row.email_id = strUserDetails.EMAIL_ID;
                            row.u_id = UNIQ_U_ID.toString();
                            row.first_name = strUserDetails.FIRST_NAME;
                            row.middle_name = strUserDetails.MIDDLE_NAME;
                            row.allocated_ip = strUserDetails.ALLOCATED_IP;
                            row.login_password = pPassword;
                            row.double_authentication = strUserDetails.DOUBLE_AUTHENTICATION;
                            row.session_timeout = strUserDetails.SESSION_TIMEOUT;
                            row.created_by = strUserid.toString();
                            row.mobile_no = strUserDetails.MOBILE_NUMBER;
                    row.client_id = pClientid;
                    row.created_date = reqDateFormater.GetTenantCurrentDateTime(req.headers, objLogInfo),
                            row.role = strUserDetails.APAAS_ROLES;
                            row.double_authentication_model = strUserDetails.DOUBLE_AUTHENTICATION_MODEL;
                            arr.push(row);
                            reqDBInstance.InsertFXDB(mCltClient, 'USERS', arr, objLogInfo, function (err, pRelt) {
                            try {
                                if (err) {
                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10016");

                                } else {
                                    reqLogWriter.TraceInfo(objLogInfo, ' - User name Created successfully ');


                                    //send response to client
                                    reqLogWriter.EventUpdate(objLogInfo);
                                    resp.send('SUCCESS');
                                }
                            } catch (error) {
                                errorHandler("ERR-FX-10014", "Error APCreateUser " + error)
                            }
                        });
                } catch (error) {
                    errorHandler("ERR-FX-10013", "Error APCreateUser " + error)
                }
            }
        }
    } catch (error) {
        errorHandler("ERR-FX-10012", "Error APCreateUser " + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});


module.exports = router;
//*******End of Serive*******//