/*
Modified BY:Udhayaraj Ms for handling enforce_change_password on 08-11-2016
*/
// Require dependencies
var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/';
var express = require('express');
var CryptoJS = require(modPath + 'crypto-js');
var uuid = require(modPath + 'uuid');
var LINQ = require('node-linq').LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
//var reqMoment = require('moment');

// Cassandra initialization
// var client = reqCasInstance.SessionValues['clt_cas'];

// Prepare queries
const pUsers = 'select * from users where login_name = ?';
const puserpwd = 'Select * from user_password_log where u_id = ? allow filtering ';
const pUserSession = 'Select u_id,login_ip,session_id from user_sessions where u_id = ? ';
const objAppst = 'select client_id, is_framework, app_id, app_code, app_description,application_type from applications where client_id = ? and is_framework = ?';
const pInsertSession = 'insert into user_sessions(u_id, login_ip,session_id, us_id, created_by, created_date, logon_time) values(?,?, ?, ?, ?, ?, ?)';
const useraccntlockdate = 'update users set account_locked_date =? where u_id =? and client_id =? and login_name = ?';
const CDCODE = 'select code_value from code_descriptions where cd_code=?';
const TENANTSETUP = 'Select * from tenant_setup where tenant_id = ?  and client_id=?';
const userLastUnsuclogUpd = 'update users set last_unsuccessful_login =? where u_id =? and client_id =? and login_name = ?';

// Initialize Global variables
var resultSessionInfo = new SessionInfo();
var strResult = '';
var strMessage = '';
var key = CryptoJS.enc.Utf8.parse('5061737323313235');
var iv = CryptoJS.enc.Utf8.parse('5061737323313235');
var router = express.Router();
var serviceName = 'DoClientSignin';

// Host the login api
router.post('/DoClientSignin', function (req, resp, next) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    objLogInfo.PROCESS = 'DoClientSignin-Authentication';
    objLogInfo.ACTION = 'DoClientSignin';
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.USER_NAME = req.body.pUname;

    try {
        var des = new DESIGNER();
        des.APP = [];
        resultSessionInfo.USER_APPS = [];
        resultSessionInfo.USER_APP = des;
        resp.setHeader('Content-Type', 'application/json');
        // Initialize local variables
        var strSessionId = req.body.pUname.toUpperCase() + '-' +

            Date.now();
        var tmpIp = req.connection.remoteAddress;
        tmpIp = tmpIp.split(':');
        // var strClientIp = tmpIp[tmpIp.length - 1];
        var strClientIp = req.headers['x-real-ip'];
        var strUname = req.body.pUname.toUpperCase();
        var strPwd = req.body.pPwd;
        var logintrycnt = req.body.pLoginTryCount;
        var ldCode = req.body.LD_CODE;
        var lang_part = req.body.LANG_PART;
        var IsCompleted = false;
        var cntAppustsTotal = 0;
        var cntSyscurrent = 0;
        var NEED_DUPLICATE_LOGIN_CHECK = '';
        var intlogintrycount = '';
        var pswdexpalertdays = '';
        var pswdexpirationdays = '';
        var CL_STP_SESSION_TIMEOUT = '';
        var arrUserApplication = [];
        var indUserApp = 0;
        var SALTKEY = req.headers["salt-session"];
        var SaltValue;
        var UserDBpwd;
        var redisSession;
        console.log('Input Params pUname : %s , strClientIp:%s , pPwd :% s, ldCode: % s, lang_part: % s ', strUname, strClientIp, strPwd, ldCode, lang_part);
        // var decrypted = DecryptPassword(strPwd);
        DoClientSignin();

        function DoClientSignin() {
            try {
                reqRedisInstance.GetRedisConnectionwithIndex(2, function (error, clientR) {
                    redisSession = clientR
                    try {
                        DBInstance.GetFXDBConnection(req.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(client) {

                            function get_salt_value(saltcallback) {
                                try {
                                    console.log('get_salt_value called')
                                    var saltRes = {}
                                    if (SALTKEY) {
                                        // console.log('query redis' + SALTKEY)
                                        redisSession.get(SALTKEY, function (err, object) {
                                            if (object) {
                                                console.log('-------------------get_salt_value  got the result')
                                                SaltValue = JSON.parse(object).salt
                                                saltRes.salt = SaltValue
                                                saltcallback(saltRes, '')
                                            } else {
                                                saltRes.message = 'Session Not available';
                                                saltcallback('', 'Please Reload The Page...');
                                                // saltcallback('', 'There is No Data Available for this Salt Key - ' + SALTKEY + ' From Redis');
                                            }
                                        });
                                    } else {
                                        console.log('There is No Data Available for this Salt Key - ' + SALTKEY + ' From Redis');
                                        saltRes.message = 'Session Not available'
                                        saltcallback(saltRes, '');
                                        // console.log('')
                                        // decrypted = reqEncHelper.DecryptPassword(strPwd);
                                        // saltRes.strPwd = decrypted
                                        // saltcallback(saltRes)
                                    }
                                } catch (error) {
                                    saltcallback('', error)
                                }
                            }



                            get_salt_value(function (res, err) {
                                if (res) {
                                    // Get user detail
                                    console.log('User Name:' + strUname)
                                    DBInstance.GetTableFromFXDB(client, 'users', [], {
                                        'login_name': strUname
                                    }, objLogInfo, function (err, result) {
                                        // client.execute(pUsers, [strUname], {
                                        //     prepare: true
                                        // }, function (err, result) {
                                        if (err)
                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10087");
                                        else {
                                            try {
                                                if (!err) {
                                                    console.log(result.rows.length);
                                                    // Check for user found or not
                                                    if (result.rows.length > 0) {
                                                        var user = result.rows[0];
                                                        UserDBpwd = user.login_password
                                                        resultSessionInfo.USER_NAME = user.first_name;
                                                        resultSessionInfo.U_ID = user.u_id;
                                                        resultSessionInfo.LOGIN_NAME = user.login_name;
                                                        resultSessionInfo.RESULT_FLAG = "Y";
                                                        resultSessionInfo.LOGIN_IP = strClientIp;
                                                        resultSessionInfo.CLIENT_ID = user.client_id;
                                                        resultSessionInfo.SESSION_ID = strSessionId;
                                                        resultSessionInfo.TARGET = user.allocated_designer;
                                                        // ClientSetup(user);
                                                        // Check for Account Locked
                                                        if (user.primary_language) {
                                                            resultSessionInfo.USER_LANG_CODE = user.primary_language.toString()
                                                        }
                                                        if (user.account_locked_date) {
                                                            strResult = 'FAILURE';
                                                            strMessage = 'User has been Locked . Please contact adminstrator';
                                                            reqLogWriter.TraceInfo(objLogInfo, 'User has been Locked . Please contact adminstrator');
                                                            PrepareResultStr(resultSessionInfo, 'act lock');
                                                            return;
                                                        }
                                                        // Check for INVALID PASSWORD
                                                        CheckInvalidPassword(user, client);
                                                    } else {
                                                        // Check for INVALID USERNAME
                                                        console.log('Invalid username');
                                                        strResult = 'FAILURE';
                                                        strMessage = 'Invalid username';
                                                        PrepareResultStr(resultSessionInfo, 'invalid user');
                                                        return;
                                                    }
                                                }
                                            } catch (error) {
                                                errorHandler("ERR-FX-10087", "Error in CP Login function ERR-003")
                                            }
                                        }
                                    });
                                } else {
                                    reqInstanceHelper.SendResponse(serviceName, resp, err, objLogInfo, '', '', '', 'FAILURE', '');
                                }
                            })
                        });
                    } catch (error) {
                        errorHandler("ERR-FX-10087", "Error in CP Login function ERR-003")
                    }
                })

            } catch (error) {
                errorHandler("ERR-FX-10086", "Error in CP Login function ERR-002")
            }
        }
        // End of fn Do_Login

        //    //Prepare the client setup
        //    function ClientSetup(user) {
        //        client.execute(clientstp, [user.client_id, "AUTHENTICATION"], function (err, res) {
        //            if (err) {
        //                return;
        //            }
        //            for (var i = 0; i <= res.length; i++) {
        //                var setupjson = res.setup_json;
        //                logintrycount = setupjson.LOGIN_TRY_COUNT;
        //                NEED_DUPLICATE_LOGIN_CHECK = objjsn("NEED_DUPLICATE_LOGIN_CHECK")
        //            }
        //        })
        //    }

        //Get Designer code
        function GetDesignerInfo(client) {
            try {
                DBInstance.GetTableFromFXDB(client, 'code_descriptions', ['code_value'], {
                    'cd_code': 'DESIGNER_CODES'
                }, objLogInfo, function (err, res) {
                    // client.execute(CDCODE, ['DESIGNER_CODES'], {
                    //     prepare: true
                    // }, function (err, res) {
                    if (err) {
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10085");

                        return;
                    }
                    for (var i = 0; i <= res.rows.length; i++) {
                        var row = res.rows;
                        resultSessionInfo.ALL_DESIGNERS = row[0].code_value;
                    }
                    AppType(client);
                })
            } catch (error) {
                errorHandler("ERR-FX-10085", "Error in CP Login function ERR-004")
            }
        }

        //Get application types
        function AppType(client) {
            try {
                DBInstance.GetTableFromFXDB(client, 'code_descriptions', ['code_value'], {
                    'cd_code': 'APPLICATION_TYPE'
                }, objLogInfo, function (err, res) {

                    // client.execute(CDCODE, ['APPLICATION_TYPE'], {
                    //     prepare: true
                    // }, function (err, res) {
                    if (err) {
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10085")
                        return
                    }
                    for (var i = 0; i <= res.rows.length; i++) {
                        var row = res.rows;
                        resultSessionInfo.APPTYPES = row[0].code_value;
                    }
                    DeviceType(client);
                })
            } catch (error) {
                errorHandler("ERR-FX-10084", "Error in CP Login function ERR-005 ")
            }
        }

        //Get device type
        function DeviceType(client) {
            try {
                DBInstance.GetTableFromFXDB(client, 'code_descriptions', ['code_value'], {
                    'cd_code': 'DEVICE_TYPE'
                }, objLogInfo, function (err, res) {

                    // client.execute(CDCODE, ['DEVICE_TYPE'], {
                    //     prepare: true
                    // }, function (err, res) {
                    if (err) {
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10085")
                        return;
                    }
                    if (res.rows.length) {
                        resultSessionInfo.DEVICE_TYPES = res.rows[0].code_value;
                    }
                    DatabaseType(client);
                })
            } catch (error) {
                errorHandler("ERR-FX-10083", "Error in CP Login function ERR-006")
            }
        }
        //Get Database type - changed by ramkumar
        function DatabaseType(client) {
            try {
                DBInstance.GetTableFromFXDB(client, 'code_descriptions', ['code_value'], {
                    'cd_code': 'DATABASE_TYPE'
                }, objLogInfo, function (err, res) {

                    // client.execute(CDCODE, ['DEVICE_TYPE'], {
                    //     prepare: true
                    // }, function (err, res) {
                    if (err) {
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10088")
                        return;
                    }
                    if (res.rows.length) {
                        resultSessionInfo.DATABASE_TYPES = res.rows[0].code_value;
                    }
                    ClientFramework(client);
                })
            } catch (error) {
                errorHandler("ERR-FX-10083", "Error in CP Login function ERR-006")
            }
        }

        //Get Database type - changed by ramkumar
        function ClientFramework(client) {
            try {
                DBInstance.GetTableFromFXDB(client, 'code_descriptions', ['code_value', 'cd_code'], {
                    'cd_code': ['MOBILE_UI_FX', 'WEB_UI_FX']
                }, objLogInfo, function (err, res) {
                    if (err) {
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10088")
                        return;
                    }
                    if (res.rows.length) {
                        for (var i = 0; i < res.rows.length; i++) {
                            resultSessionInfo[res.rows[i].cd_code.toUpperCase()] = res.rows[i].code_value;
                        }
                    }
                    GetApp(client);
                })
            } catch (error) {
                errorHandler("ERR-FX-10083", "Error in CP Login function ERR-006")
            }
        }

        // Check for Invalid password
        function CheckInvalidPassword(user, client) {
            try {



                var HashedDBPwd = reqEncHelper.passwordHash256Withsalt(user.login_password, SaltValue)

                if (HashedDBPwd != strPwd) {
                    strResult = 'FAILURE';
                    strMessage = 'Invalid password';
                    DBInstance.UpdateFXDB(client, 'users', {
                        'last_unsuccessful_login': reqDateFormater.GetTenantCurrentDateTime(req.headers, objLogInfo)
                    }, {
                            'u_id': user.u_id,
                            'client_id': user.client_id,
                            'login_name': user.login_name
                        }, objLogInfo, function (err) {
                            // client.execute(userLastUnsuclogUpd, [Date.now(), user.u_id, user.client_id, user.login_name], {
                            //     prepare: true
                            // }, function (err) {
                            if (err)
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-100812")

                            else {
                                reqLogWriter.TraceInfo(objLogInfo, 'Invalid password');

                                PrepareResultStr(resultSessionInfo, 'invalid pwd');
                                return;
                            }
                        });
                } else {
                    CheckFirstTimeLogin(user, client)
                }
            } catch (error) {
                console.log(error)
                errorHandler("ERR-FX-10082", "Error in CP Login function ERR-007")
            }
        }

        // Check for FIRST TIME LOGIN
        function CheckFirstTimeLogin(user, client) {
            try {
                console.log('CheckFirstTimeLogin')
                DBInstance.GetTableFromFXDB(client, 'user_password_log', [], {
                    'u_id': user.u_id
                }, objLogInfo, function (err, pwglogresult) {
                    // client.execute(puserpwd, [user.u_id], {
                    //     prepare: true
                    // }, function (err, pwglogresult) {
                    if (err)
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10081");
                    else {
                        console.log('pwglogresult.rows.length-----' + pwglogresult.rows.length)
                        if (pwglogresult.rows.length <= 1 && user.enforce_change_password == 'Y') {
                            resultSessionInfo.LOGIN_RESULT = 'FIRST_TIME_LOGIN';
                            resultSessionInfo.MESSAGE = 'User first-time login. Please change your password';
                            resultSessionInfo.LOGIN_IP = strClientIp;
                            reqLogWriter.TraceInfo(objLogInfo, 'User first-time login. Please change your password');
                            resp.send(resultSessionInfo);
                            //PrepareResultStr(resultSessionInfo, 'first time login');
                            // return;
                        } else {
                            CheckAlreadyLoggedIn(user, client)
                        }
                    }
                });
            } catch (error) {
                errorHandler("ERR-FX-10081", "Error in CP Login function ERR-008")
            }
        }

        // Check for Already Logged In
        function CheckAlreadyLoggedIn(user, client) {
            try {
                //ALREADY LOGGED IN
                DBInstance.GetTableFromFXDB(client, 'user_sessions', ['u_id', 'login_ip', 'session_id'], {
                    'u_id': user.u_id
                }, objLogInfo, function (err, result) {
                    // client.execute(pUserSession, [user.u_id], {
                    //     prepare: true
                    // }, function (err, result) {
                    if (err)
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10080");
                    else {
                        DBInstance.GetTableFromFXDB(client, 'client_setup', [], {
                            'client_id': user.client_id
                        }, objLogInfo, function (err, cltresult) {
                            // client.execute(TENANTSETUP, ['0', user.client_id], {
                            //     prepare: true
                            // }, function (err, cltresult) {
                            if (err)
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10080");
                            else {
                                reqLogWriter.TraceInfo(objLogInfo, 'Clientsetup ' + cltresult.rows.length);
                                if (!err && cltresult.rows.length > 0) {

                                    var authSetup = new LINQ(cltresult.rows)
                                        .Where(function (item) {
                                            return item.category === "AUTHENTICATION";
                                        }).ToArray();

                                    if (authSetup.length > 0) {
                                        PrepareAuthenticationSetup(authSetup[0]);

                                        // ALREADY LOGGED IN
                                        reqLogWriter.TraceInfo(objLogInfo, 'NEED_DUPLICATE_LOGIN_CHECK' + NEED_DUPLICATE_LOGIN_CHECK);
                                        if (typeof (NEED_DUPLICATE_LOGIN_CHECK) == 'undefined' || NEED_DUPLICATE_LOGIN_CHECK == null || NEED_DUPLICATE_LOGIN_CHECK == 'Y') {
                                            for (usrSes = 0; usrSes < result.rows.length; usrSes++) {
                                                //if (result.rows[usrSes].login_ip != strClientIp) {
                                                strResult = 'ALREADY LOGGED IN';
                                                strMessage = 'User has already logged in from another system';
                                                PrepareResultStr(resultSessionInfo, 'duplicate login chk');
                                                return;
                                                // }
                                            }
                                        }
                                        //LOGIN TRY COUNT
                                        if (intlogintrycount < logintrycnt) {
                                            strResult = 'FAILURE';
                                            strMessage = 'User has been Locked . Please contact adminstrator';
                                            DBInstance.UpdateFXDB(client, 'users', {
                                                'account_locked_date': reqDateFormater.GetTenantCurrentDateTime(req.headers, objLogInfo),
                                            }, {
                                                    'u_id': user.u_id,
                                                    'client_id': user.client_id,
                                                    'login_name': user.login_name
                                                }, objLogInfo, function (err) {
                                                    // client.execute(useraccntlockdate, [Date.now, user.u_id, user.client_id, user.login_name], {
                                                    //     prepare: true
                                                    // }, function (err) {
                                                    if (err) {
                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10080");
                                                    }
                                                    PrepareResultStr(resultSessionInfo, 'Login try count');
                                                })
                                        } else {
                                            //Success callback
                                            reqLogWriter.TraceInfo(objLogInfo, 'SuccessCallback');

                                            SuccessCallback(cltresult, user, client);
                                            return;
                                        }
                                    } else {
                                        reqLogWriter.TraceInfo(objLogInfo, 'Client Setup missing for AUTHENTICATION');
                                        strResult = 'FAILURE';
                                        strMessage = 'Client setup missing';
                                        PrepareResultStr(resultSessionInfo, 'no client setup');
                                        return;
                                    }
                                } else {
                                    reqLogWriter.TraceInfo(objLogInfo, 'Client Setup missing for Login Process');
                                    strResult = 'FAILURE';
                                    strMessage = 'Client setup missing';
                                    PrepareResultStr(resultSessionInfo, 'no client setup');
                                    return;
                                }
                            }
                        });
                    }
                });

            } catch (error) {
                errorHandler("ERR-FX-10080", "Error in CP Login function ERR-009")
            }
        }

        //Prepare App
        function GetApp(client) {
            try {
                reqLogWriter.TraceInfo(objLogInfo, 'app query params ' + resultSessionInfo.CLIENT_ID);
                DBInstance.GetTableFromFXDB(client, 'applications', ['client_id', 'is_framework', 'app_id', 'app_code', 'app_description', 'application_type', 'home_page', 'image_json', 'db_type', 'web_ui_framework', 'mob_ui_framework', 'app_icon_data','devops_settings'], {
                    'client_id': resultSessionInfo.CLIENT_ID,
                    'is_framework': 'N'
                }, objLogInfo, function (error, result) {
                    // client.execute(objAppst, [resultSessionInfo.CLIENT_ID, 'N'],
                    //     function (err, res) {
                    try {
                        if (error) {
                            reqLogWriter.TraceError(objLogInfo, error, "ERR-FX-10079");
                            return
                        } else {
                            reqLogWriter.TraceInfo(objLogInfo, 'GET APP:" + res');

                            console.log("GET APP:" + result);
                            var applications = result.rows;
                            //        var res = [{
                            //            "app_id": "01",
                            //            "app_code": "hg76",
                            //            "app_description": "Hello",
                            //            "application_type": "hjgfj"
                            //        }]
                            //        console.log("REsult:: " + res.length)
                            reqLogWriter.TraceInfo(objLogInfo, 'GETAPPLENGTH::" + res.rows.length');
                            var arrApp = [];

                            DBInstance.GetTableFromFXDB(client, 'designer_access_log', [], {
                                'client_id': resultSessionInfo.CLIENT_ID,
                                'category': 'APPLICATION',
                                'login_name': strUname
                            }, objLogInfo, function (error, result) {
                                try {
                                    if (error) {
                                        reqLogWriter.TraceError(objLogInfo, error, "errcode");
                                    } else {
                                        var accessLogs = result.rows;
                                        var arrWithAccessLog = [];
                                        var arrWithOutAccessLog = [];
                                        for (var i = 0; i < applications.length; i++) {
                                            var obj = {};
                                            var application = applications[i];
                                            obj.APP_ID = application.app_id;
                                            obj.APP_CODE = application.app_code;
                                            obj.APP_DESCRIPTION = application.app_description;
                                            obj.APP_TYPE = application.application_type;
                                            obj.HOME_PAGE = application.home_page;
                                            obj.IMAGE_JSON = application.image_json;
                                            obj.APP_DBTYPE = application.db_type;
                                            obj.APP_MOB_UI_FX = application.mob_ui_framework;
                                            obj.APP_WEB_UI_FX = application.web_ui_framework;
                                            obj.APP_ICON_DATA = application.app_icon_data;
											obj.APP_DEVOPS_SETTINGS = application.devops_settings;
                                            for (var j = 0; j < accessLogs.length; j++) {
                                                var accessLog = accessLogs[j];
                                                if (obj.APP_CODE == accessLog.code) {
                                                    obj.ACCESS_TIME = accessLog.access_time;
                                                    break;
                                                }
                                            }
                                            if (obj.ACCESS_TIME) {
                                                arrWithAccessLog.push(obj);
                                            } else {
                                                arrWithOutAccessLog.push(obj);
                                            }
                                        }
                                        arrWithAccessLog.sort(function (a, b) {
                                            var dateA = new Date(a.ACCESS_TIME),
                                                dateB = new Date(b.ACCESS_TIME);
                                            return dateB - dateA; //sort by date descending
                                        });
                                        arrWithOutAccessLog.sort(function (a, b) {
                                            var nameA = a.APP_DESCRIPTION.toLowerCase(),
                                                nameB = b.APP_DESCRIPTION.toLowerCase()
                                            if (nameA < nameB) //sort string ascending
                                                return -1
                                            if (nameA > nameB)
                                                return 1
                                            return 0 //default return value (no sorting)
                                        });
                                        arrApp = arrWithAccessLog.concat(arrWithOutAccessLog);
                                        resultSessionInfo.USER_APP.APP = arrApp;
                                        PrepareResultStr(resultSessionInfo, 'Success case');
                                    }
                                } catch (error) {
                                    reqLogWriter.TraceError(objLogInfo, error, "errcode");
                                }
                            });
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10079", "Error in CP Login function ")
                    }
                })
            } catch (error) {
                errorHandler("ERR-FX-10078", "Error in CP Login function ERR-009 ")
            }
        }

        // Prepare client setup info
        // Assign CHAT_PASS and CHAT_ENABLE properties
        function FillClientSetup(rowsCltSetUp, user, client) {
            try {
                var jwttoken = '';
                try {
                    for (var i = 0; i < rowsCltSetUp.rows.length; i++) {
                        var cltsetup = rowsCltSetUp.rows[i];
                        var setup = cltsetup.category;
                        switch (setup) {
                            case "CHT_USR_ORG_PWD":
                                if (cltsetup.setup_json != null) {
                                    var parsedObj = JSON.parse(cltsetup.setup_json);
                                    resultSessionInfo.CHAT_PASS = parsedObj.CHT_USR_ORG_PWD;
                                }
                                break;
                            case "ENABLE_CHAT":
                                if (cltsetup.setup_json != null) {
                                    var parsedObj = JSON.parse(cltsetup.setup_json);
                                    resultSessionInfo.CHAT_ENABLE = parsedObj.ENABLE_CHAT;
                                }
                                break;
                            case "ENABLE_JWT":
                                if (cltsetup.setup_json != null) {
                                    var parsedObj = JSON.parse(cltsetup.setup_json);
                                    resultSessionInfo.ENABLE_JWT = parsedObj.ENABLE_JWT;
                                }
                                break;
                            case "CURRENT_JWT":
                                if (cltsetup.setup_json != null) {
                                    var parsedObj = JSON.parse(cltsetup.setup_json);
                                    jwttoken = parsedObj.Token;
                                }
                                break;
                            default:
                                break;
                        }
                    }
                } catch (err) {
                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10077");
                }
                if (resultSessionInfo.ENABLE_JWT == 'Y') {
                    resultSessionInfo.API_GATEWAY_SETUP = new API_GATEWAY_SETUP;
                    resultSessionInfo.API_GATEWAY_SETUP.SessionToken = jwttoken;
                }

                GetDesignerInfo(client);
            } catch (error) {
                errorHandler("ERR-FX-10077", "Error in CP Login function ERR-010")
            }
        }
        // Prepare client AUTHENTICATION setup
        function PrepareAuthenticationSetup(authSetup) {
            try {
                var clientRow = authSetup;
                var setupjson = clientRow.setup_json;
                var parsedObj = JSON.parse(setupjson);
                intlogintrycount = parsedObj.LOGIN_TRY_COUNT;
                pswdexpalertdays = parsedObj.PWD_EXPIRY_ALERT_DAYS;
                pswdexpirationdays = parsedObj.PWD_EXPIRATION_DAYS;
                OTP_SMS_TEMPLATE = parsedObj.OTP_SMS_TEMPLATE;
                OTP_MAIL_TEMPLATE = parsedObj.OTP_MAIL_TEMPLATE;
                NEED_DUPLICATE_LOGIN_CHECK = parsedObj.NEED_DUPLICATE_LOGIN_CHECK;
                //        if (parsedObj.SESSION_TIMEOUT != null) {
                //            CL_STP_SESSION_TIMEOUT =parsedObj.SESSION_TIMEOUT;
                //        }
                if (parsedObj.RECORDS_PER_PAGE != null) {
                    resultSessionInfo.RECORDS_PER_PAGE = parsedObj.RECORDS_PER_PAGE;
                }
            } catch (error) {
                errorHandler("ERR-FX-10076", "Error in CP Login function ERR-011 ")
            }
        }
        // Assign session info values for success case
        function SuccessCallback(rowsCltSetUp, user, client) {
            try {
                strResult = 'SUCCESS';
                strMessage = 'User Login Successfully';
                resultSessionInfo.RESULT_FLAG = 'Y';
                resultSessionInfo.USER_NAME = user.first_name;
                resultSessionInfo.U_ID = user.u_id;
                resultSessionInfo.LOGIN_NAME = user.login_name;
                //jwt

                if (user.primary_language != null) {
                    resultSessionInfo.USER_LANG_CODE = user.primary_language.toString();
                }
                resultSessionInfo.SESSION_ID = strSessionId;
                resultSessionInfo.SESSION_TIMEOUT = 0;

                if (user.allocated_static_module != null)
                    resultSessionInfo.ALLOCATED_STATIC_MODULE = user.allocated_static_module;
                else
                    resultSessionInfo.ALLOCATED_STATIC_MODULE = '[]';

                if (user.last_successful_login != null)
                    resultSessionInfo.LAST_SUCCESSFUL_LOGIN = user.last_successful_login;
                else
                    resultSessionInfo.LAST_SUCCESSFUL_LOGIN = '';

                if (user.last_unsuccessful_login != null)
                    resultSessionInfo.LAST_UNSUCCESSFUL_LOGIN = user.last_unsuccessful_login;
                else
                    resultSessionInfo.LAST_UNSUCCESSFUL_LOGIN = '';

                // Insert user sessions
                //var params = [user.u_id, strClientIp, strSessionId, uuid.v1(), user.u_id, reqDateFormater.GetTenantCurrentDateTime(req.headers, objLogInfo), Date.now()];

                const pInsertSession = 'insert into user_sessions(u_id, login_ip,session_id, us_id, created_by, created_date, logon_time) values(?,?, ?, ?, ?, ?, ?)';
                DBInstance.InsertFXDB(client, 'user_sessions', [{
                    'u_id': user.u_id,
                    'login_ip': strClientIp,
                    'session_id': strSessionId,
                    'us_id': uuid.v1(),
                    'created_by': user.u_id,
                    'created_date': reqDateFormater.GetTenantCurrentDateTime(req.headers, objLogInfo),
                    'logon_time': reqDateFormater.GetTenantCurrentDateTime(req.headers, objLogInfo),
                }], objLogInfo, function (err) {
                    // client.execute(pInsertSession, params, {
                    //     prepare: true,
                    //     hints: ['varchar', 'varchar', 'varchar', 'varchar',

                    //         'varchar', 'timestamp'
                    //     ]
                    // }, function (err) {
                    try {
                        if (err) {

                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10075");
                        }
                        FillClientSetup(rowsCltSetUp, user, client)
                    } catch (error) {
                        errorHandler("ERR-FX-10075", "Error in CP Login function ERR-013")
                    }
                })
            } catch (error) {
                errorHandler("ERR-FX-10074", "Error in CP Login function ERR-012 ")
            }
        }

        function PrepareResultStr(Sess_info, pParent) {
            try {
                resultSessionInfo.LOGIN_RESULT = strResult;
                resultSessionInfo.MESSAGE = strMessage;
                resultSessionInfo.LOGIN_IP = strClientIp;
                ResultStr = JSON.stringify(Sess_info);
                // reqLogWriter.TraceInfo(objLogInfo, 'Result Json' + ResultStr);
                resp.write(ResultStr);
                reqLogWriter.EventUpdate(objLogInfo);
                resp.end();
                if (strResult == "SUCCESS" && SALTKEY) {
                    redisSession.del(SALTKEY, function (err, reply) {
                        if (err) {
                            errorHandler('err occured while delete salt key', '');
                        } else {
                            errorHandler('Salt key delete Successfully', '');
                        }
                    })
                }
            } catch (error) {
                errorHandler("ERR-FX-10073", "Error in CP Login function ERR-014 ")
            }
        }
        // Encrypt password
        function EncryptPassword(strPassword) {
            try {
                var crypto = require('crypto');
                shasum = crypto.createHash('sha1');
                shasum.update(strPassword);
                var encryptedPwd = shasum.digest('hex').toUpperCase();
                return encryptedPwd;
            } catch (error) {
                errorHandler("ERR-FX-10072", "Error in CP Login function ERR-015")
            }
        }
        // Decrypt password
        function DecryptPassword(strEncrypted) {
            try {
                var decrypted = CryptoJS.AES.decrypt(strEncrypted, key, {
                    keySize: 128 / 8,
                    iv: iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                });
                return CryptoJS.enc.Utf8.stringify(decrypted);
            } catch (error) {
                errorHandler("ERR-FX-10071", "Error in CP Login function ERR-016" + error)
            }
        }
    } catch (error) {
        errorHandler("ERR-FX-10070", "Error in CP Login function ERR-001 " + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }

});

// Session Class declaration
function SessionInfo() {
    this.LOGIN_RESULT = "";
    this.RESULT_FLAG = "";
    this.USER_NAME = "";
    this.LOGIN_NAME = "";
    this.U_ID = "";
    this.CLIENT_ID = "";
    this.RECORDS_PER_PAGE = 10;
    this.MESSAGE = "";
    this.ENCRYPTION_KEY = "";
    this.USER_LANG_CODE = "";
    this.USER_APPS = [];
    this.SESSION_ID = "";
    this.SESSION_TIMEOUT = "";
    this.USER_LANGUAGES = "";
    this.APPSYS = "";
    this.TEST_VALUE = "";
    this.USER_QUEUE = "";
    this.LOGIN_IP = "";
    this.TARGET = "";
    this.ALL_DESIGNERS = "";
    this.CHAT_PASS = "";
    this.CHAT_ENABLE = "";
    this.DATE_FORMAT = "dd/MM/yyyy";
    this.USER_APP = new DESIGNER();
    this.APP_ID = "";
    this.APP_NAME = "";
    this.APPUSTS_ID = "";
    this.APPU_ID = "";
    this.APP_USER_ROLES = "";
    this.WFT_CODE = "";
    this.APP_STS_ID = "";
    this.STS_ID = "";
    this.S_ID = "";
    this.S_DESC = "";
    this.CLUSTER_CODE = "";
    this.SYSTEM_USER_ROLE = "";
    this.DISCLAIMER_MESSAGE = "";
    this.DISCLAIMER = "";
    this.NEED_WATER_MARKING = "";
    this.SU_ID = "";
    this.RS_DB_INFO = "";
    this.RS_STORAGE_TYPE = "";
    this.CB_SERVICE = "";
    this.CB_HANDLER = "";
    this.ATT_VIEWER = "";
    this.ACCUSOFT_HOST_NAME = "";
    this.NEED_ENCRYPTION = "";
    this.GDPIC_KEY = "";
    this.ATMT_VWR_TYPE = "ACCUSOFT";
    this.NEED_OTP = "";
    this.LAST_SUCCESSFUL_LOGIN = "";
    this.LAST_UNSUCCESSFUL_LOGIN = "";
    this.PASSWORD_POLICY = "";
    this.ALLOCATED_STATIC_MODULE = "";
    this.APPTYPES = "";
    this.DEVICE_TYPES = "";
    this.LANG_DATA = "";
    this.APP_LANG_DATA = "";
    this.API_GATEWAY_SETUP = "";
};

function DESIGNER() {
    this.APP = [];
    this.ROLE_CODE = "";
    this.ROLE_DESCRIPTION = "";
    this.TARGET = "";
    this.RESULT = "";
    this.MESSAGE = "";
};

function API_GATEWAY_SETUP() {
    this.SessionToken = "";
};

//var app={APP_ID:"",APP_CODE:"",APP_DESCRIPTION:"",APP_ICON:"",APP_TYPE:""};

module.exports = router;