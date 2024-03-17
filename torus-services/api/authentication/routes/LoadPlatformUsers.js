// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');

// Cassandra initialization
var mCltClient = '';

const LOGINNAME = 'select login_name from users_platform_details where client_id=? allow filtering';
const USERSSEL = 'select * from users where client_id=?allow filtering';
const DESIGNERSSEL = 'select code_value from code_descriptions where cd_code=? allow filtering';
const PWDPOLICY = 'select setup_json from tenant_setup where category=? and tenant_id=? and client_id=?';
var arrUsers = [];
var strDes = '';
var strPwd = '';
var strRes = {};
var inc = 0;
var objLogInfo = '';

function errorHandler(errcode, message) {
    console.log(message, errcode);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
}
router.post('/LoadPlatformUsers', function (pReq, pResp, pNext) {
    objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'LoadPlatformUsers-Authentication';
    objLogInfo.ACTION = 'LoadPlatformUsers';
    reqLogWriter.Eventinsert(objLogInfo);
    arrUsers = [];

    try {
        pHeaders = pReq.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            //reqCasInstance.GetCassandraConn(pHeaders, 'clt_cas', function Callback_GetCassandraConn(pClient) {
            mCltClient = pClient;
            reqLogWriter.TraceInfo(objLogInfo, ' clt_cas is :' + mCltClient);

            strDes = '';
            strPwd = '';
            strRes = {};
            inc = 0;
            reqLogWriter.TraceInfo(objLogInfo, 'Load Platform user called...');
            // Initialize local variables
            pResp.setHeader('Content-Type', 'text/plain');
            var pClientId = pReq.body.CLIENT_ID;
            PrepareRespInfo(pClientId);

            //Prepare response
            function PrepareRespInfo(pClientId) {
                reqLogWriter.TraceInfo(objLogInfo, ' PrepareRespInfo function called...');
                try {
                    GetLoginName(pClientId, function callback(strRes) {
                        if (inc == 1) {
                            reqLogWriter.TraceInfo(objLogInfo, 'Platform users Loaded successfully...');
                            reqLogWriter.EventUpdate(objLogInfo);
                            pResp.send(JSON.stringify(strRes));
                        }
                    });
                } catch (error) {
                    errorHandler("ERR-FX-10161", "Error LoadPlatformUsers function" + error);
                }
            }
        });
    } catch (error) {
        errorHandler("ERR-FX-10160", "Error LoadPlatformUsers function" + error);
    }


});

//Prepare to get the login name
function GetLoginName(pClientId, callback) {
    try {
        var ln = 0;
        arrUsers = [];
        DBInstance.GetTableFromFXDB(mCltClient, 'users', [], {
            'client_id': pClientId
        }, objLogInfo, function callbackusers(err, res) {
            try {
                reqLogWriter.TraceInfo(objLogInfo, 'Executed query :' + USERSSEL);
                if (err) {
                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10159");
                } else {
                    ln = ln + 1;
                    for (var j = 0; j < res.rows.length; j++) {
                        reqLogWriter.TraceInfo(objLogInfo, 'for loop executing...' + 'loop count is : ' + j);
                        var userdetails = res.rows[j];
                        var obj = {};
                        obj.U_ID = userdetails.u_id;
                        obj.FIRST_NAME = userdetails.first_name;
                        obj.MIDDLE_NAME = userdetails.middle_name;
                        obj.LAST_NAME = userdetails.last_name;
                        obj.LOGIN_NAME = userdetails.login_name;
                        obj.EMAIL_ID = userdetails.email_id;
                        obj.ALLOCATED_IP = userdetails.allocated_ip;
                        obj.DESCRIPTION = 'LOGIN_NAME';
                        obj.ACTION = 'User_Selection';
                        obj.USER_SYSTEMS = [];
                        obj.USER_ROLES = [];
                        obj.CODE = 'LOGIN_NAME';
                        obj.PASSWORD = userdetails.login_password;
                        obj.DOUBLE_AUTHENTICATION = userdetails.double_authentication;
                        obj.DOUBLE_AUTHENTICATION_MODEL = userdetails.double_authentication_model;
                        obj.NEED_WATERMARKING = userdetails.water_marking;
                        obj.SESSION_TIMEOUT = userdetails.session_timeout;
                        try {
                            obj.DESIGNERS = JSON.parse(userdetails.allocated_designer); //array
                        } catch (e) {
                            console.log(e);
                        }
                        obj.MOBILE_NUMBER = userdetails.mobile_no;
                        obj.ENFORCE_CHANGE_PWD = userdetails.enforce_change_password;
                        arrUsers.push(obj);

                    }
                    strRes.USERS = arrUsers;
                    GetDesigners(pClientId, callback);
                }
            } catch (error) {
                errorHandler("ERR-FX-10159", "Error LoadPlatformUsers function" + error);
            }
        });
    } catch (error) {
        errorHandler("ERR-FX-10158", "Error LoadPlatformUsers function" + error);
    }
}

//Prepare Designers code value
function GetDesigners(pClientId, callback) {
    reqLogWriter.TraceInfo(objLogInfo, 'GetDesigners function called...');
    try {
        DBInstance.GetTableFromFXDB(mCltClient, 'code_descriptions', ['code_value'], {
            'cd_code': 'DESIGNER_CODES'
        }, objLogInfo, function callbackdesigners(err, result) {
            try {
                reqLogWriter.TraceInfo(objLogInfo, 'Executed query : ' + DESIGNERSSEL);
                if (err) {
                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10156");
                } else {
                    strDes = result.rows;
                    var arrDesign = JSON.parse(strDes[0].code_value);
                    strRes.DESIGNERS = arrDesign;
                    GetPwdPolicy(pClientId, callback);
                }
            } catch (error) {
                errorHandler("ERR-FX-10156", "Error LoadPlatformUsers function" + error);
            }
        });
    } catch (error) {
        errorHandler("ERR-FX-10155", "Error LoadPlatformUsers function" + error);
    }
}

//Prepare password policy
function GetPwdPolicy(pClientId, callback) {
    reqLogWriter.TraceInfo(objLogInfo, 'GetPwdPolicy function called...');
    try {
        var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            var cond = {};
            cond.setup_code = 'PASSWORD_POLICY';
            reqsvchelper.GetSetupJson(mCltClient, cond, objLogInfo, function (res) {
                if (res.Status == 'SUCCESS' && res.Data.length) {
                    strRes.PASSWORD_POLICY = JSON.parse(res.Data[0].setup_json);
                    inc = inc + 1;
                    return callback(strRes);
                } else {
                    return reqInstanceHelper.SendResponse('LoadPlatformusers', appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                }
            });
        } else {

            DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', ['setup_json'], {
                'category': 'PASSWORD_POLICY',
                'tenant_id': '0',
                'client_id': pClientId
            }, objLogInfo, function callbackpwdpolicy(err, result) {
                // mCltClient.execute(PWDPOLICY, ['PASSWORD_POLICY', '0', pClientId], {
                //     prepare: true
                // }, function callbackpwdpolicy(err, result) {
                reqLogWriter.TraceInfo(objLogInfo, 'Executed Query :' + PWDPOLICY + 'Params are  category : PASSWORD_POLICY' + ' Tenant_id : 0' + 'ClientId :' + pClientId);
                if (err) {
                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10156");
                } else {
                    strPwd = result.rows;
                    strRes.PASSWORD_POLICY = JSON.parse(strPwd[0].setup_json);
                    inc = inc + 1;
                    return callback(strRes);
                }
            });

        }
    } catch (error) {
        errorHandler("ERR-FX-10154", "Error LoadPlatformUsers function" + error);
    }
}

module.exports = router;
module.exports.GetLoginName = GetLoginName;

//Prepare object info
// module.exports = {
//     GetLoginName: GetLoginName,
//     router: router
// };