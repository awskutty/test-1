var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');
var reqsvchelper = require('../../../../../torus-references/common/serviceHelper/ServiceHelper');
var SmoothCaptcha = require('svg-captcha-smooth');
var reqLINQ = require('node-linq').LINQ;
var reqUuid = require('uuid');
const { resolve } = require('path');
const { reject } = require('lodash');
var defaultRedisKey = 'clt-0~app-0~tnt-0~env-0';
var serviceName = 'LoginPageHelper';
// var objLogInfo = null;
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
function getLoginPageInfo(params, headers, objLogInfo, callback) {
    try {
        var response = {
            languages: [],
            captcha: {},
            env_mode: 'PROD'
        };
        var isLanguagesLoaded = false;
        var isCaptchaLoaded = false;
        var isEncCodeLoaded = false;
        var isLoginConfigLoaded = false;
        if (params.CATEGORY.indexOf("CP_CAPTCHA") > -1) {
            //for cp/wp separation, to remove trandb conn from cp.
            response.languages = [];
            isLanguagesLoaded = true;
            finalResp();
        } else {
            getLanguages(headers, objLogInfo, function (error, result) {
                isLanguagesLoaded = true;
                if (error) {
                    response.languages = error;
                } else {
                    response.languages = result;
                }
                finalResp();
            });
        }
        getCaptcha(params, headers, objLogInfo, function (error, result) {
            isCaptchaLoaded = true;
            if (error) {
                response.captcha = error;
            } else {
                response.captcha = result.Captcha;
                response.LoginDeatil = result.LOGINDETAIL;
            }
            finalResp();
        });
        getEnvCode(function (error, result) {
            isEncCodeLoaded = true;
            if (error) {
                response.env_mode = error;
            } else {
                response.env_mode = result;
            }
            finalResp();
        });
        getLoginConfig(headers, params, objLogInfo, function (result) {
            isLoginConfigLoaded = true;
            response.LOGIN_CONFIG = result;
            finalResp();
        });

        function finalResp() {
            try {
                if (isLanguagesLoaded && isCaptchaLoaded && isEncCodeLoaded && isLoginConfigLoaded) {
                    //Session creation page load

                    PrepareSlat('LoginLoading', response.captcha, function (err, res) {
                        try {
                            response.SaltKey = res.SaltKey;
                            response.SaltValue = res.SaltValue;
                            callback(null, response);
                        } catch (error) {
                            callback(error);
                        }
                    });
                    // reqRedisInstance.GetRedisConnection(function (error, clientR) {
                    //     try {
                    //         if (error) {
                    //             console.log('error')
                    //         } else {
                    //             var Rediskey = reqUuid.v1();
                    //             var RedisValue = {
                    //                 salt: reqUuid()
                    //             }
                    //             response.SaltKey = Rediskey;
                    //             response.SaltValue = RedisValue.salt;
                    //             reqRedisInstance.RedisInsert(clientR, Rediskey, RedisValue, 24 * 60 * 60)
                    //             callback(null, response);
                    //         }
                    //     } catch (error) {
                    //         callback(error);
                    //     }

                    // })

                }
            } catch (error) {
                callback(error);
            }
        }
    } catch (error) {
        callback(error);
    }
}


function PrepareSlat(callfrom, captcha, callback) {
    try {
        reqRedisInstance.GetRedisConnectionwithIndex(2, function (error, RedisSession) {
            try {
                if (error) {
                    console.log('error');
                } else {
                    var Rediskey = reqUuid.v1();
                    var RedisValue = {
                        salt: reqUuid.v4()
                    };
                    var res = {};
                    res.SaltKey = Rediskey;
                    res.SaltValue = RedisValue.salt;
                    if (callfrom == 'LoginLoading') {
                        InsertSaltintoRedis(RedisSession, Rediskey, RedisValue.salt, captcha);
                        // if (result == "SUCCESS") {
                        callback(null, res);
                        // }
                        // })
                    } else {
                        reqRedisInstance.RedisInsert(RedisSession, Rediskey, RedisValue, 24 * 60 * 60);
                        callback(null, res);
                    }

                }
            } catch (error) {
                callback(error);
            }
        });
    } catch (error) {
        callback(error);
    }
}


function InsertSaltintoRedis(RedisConn, Rediskey, saltvalue, captcha) {
    try {
        var redisdata = {};
        redisdata.salt = saltvalue;
        if (captcha) {
            redisdata.captcha = captcha.Captchadata;
        }
        reqRedisInstance.RedisInsert(RedisConn, Rediskey, redisdata, 24 * 60 * 60);
        delete captcha.Captchadata
        // callback('SUCCESS')
    } catch (error) {
        // callback(error);
    }

}

function getLanguages(pHeaders, objLogInfo, callback) {
    try {
        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            try {
                reqTranDBInstance.GetTableFromTranDB(pSession, 'languages', {}, objLogInfo, function (result, error) {
                    try {
                        if (error) {
                            callback(error);
                        } else {
                            if (result.length) {

                                var LangArr = new reqLINQ(result)
                                    .OrderBy(function (row) {
                                        return row.language_code;
                                    })
                                    .ToArray();


                                callback(null, LangArr);
                            } else {
                                callback(null, 'No rows Found');
                            }
                        }
                    } catch (error) {
                        callback(error);
                    }
                });
            } catch (error) {
                callback(error);
            }
        });
    } catch (error) {
        callback(error);
    }
}

function getCaptcha(params, pHeaders, objLogInfo, callback) {
    try {
        var CaptchaParam = {};
        var isWP = false;
        if (params.CATEGORY.indexOf("CAPTCHA") > -1) {
            //This is for WP Capthca
            isWP = true;
            CaptchaParam.tableName = 'tenant_setup';
            CaptchaParam.cond = {
                'client_id': params.CLIENT_ID,
                'tenant_id': params.TENANT_ID,
                'category': params.CATEGORY
            };
        } else if (params.CATEGORY.indexOf("CP_CAPTCHA") > -1) {
            //This is for CP Capthca
            CaptchaParam.tableName = 'client_setup';
            if (params.CLIENT_ID == undefined) {
                params.CLIENT_ID = 0;
            }
            CaptchaParam.cond = {
                'client_id': params.CLIENT_ID,
                'category': params.CATEGORY
            };
        }
        reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            if (isWP && serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                var cond = {};
                cond.setup_code = params.CATEGORY;
                cond.TenatId = CaptchaParam.cond.tenant_id;
                reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                    if (res.Status == 'SUCCESS' && res.Data.length) {
                        aftergetsetupJson(res.Data);
                    } else {
                        //return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                        return callback(null, res);
                    }
                });
            } else {
                reqDBInstance.GetTableFromFXDB(pClient, CaptchaParam.tableName, [], CaptchaParam.cond, objLogInfo, function (error, pResult) {
                    try {
                        if (error) {
                            return callback(error);
                        } else {
                            try {
                                if (pResult.rows.length > 0) {
                                    aftergetsetupJson(pResult.rows);
                                } else {
                                    return callback(null, 'No data found');
                                }
                            } catch (error) {
                                return callback('Exception occured ' + error, null);
                            }
                        }
                    } catch (error) {
                        return callback('Exception occured ' + error, null);
                    }
                });
            }

            function aftergetsetupJson(pResult) {
                var response = {};
                try {
                    if (pResult.length > 0) {
                        for (i = 0; i < pResult.length; i++) {
                            if (pResult[i].category == 'CAPTCHA' || pResult[i].category == 'CP_CAPTCHA') {
                                var captchaSetup = '';
                                var captchaDetail = {};
                                captchaSetup = JSON.parse(pResult[i].setup_json);
                                if (captchaSetup.NEED_CAPTCHA == 'Y') {
                                    var options = {
                                        fontSize: 40,
                                        charPreset: 7
                                    };
                                    captchaDetail.NEED_CAPTCHA = 'Y';
                                    var CaptchaType = captchaSetup.CAPTCHA_TYPE;
                                    console.log('Captcha type is ' + CaptchaType);
                                    captchaDetail.CaptchaType = CaptchaType;
                                    if (CaptchaType == 'TEXTCAPTCHA') {
                                        options.noise = captchaSetup.TEXTCAPTCHA.NOISE;
                                        options.size = captchaSetup.TEXTCAPTCHA.LENGTH;
                                        var possible = "abcdefghjkmnopqrstuvwxyz";
                                        var text = "";
                                        for (var possibleLength = 0; possibleLength < options.size; possibleLength++) {
                                            text += possible.charAt(Math.floor(Math.random() * possible.length));
                                        }
                                        var captcha = {};
                                        captcha.text = text;
                                        captcha.data = SmoothCaptcha(text, options);
                                    } else if (CaptchaType == 'MATHCAPTCHA') {
                                        options.noise = captchaSetup.MATHCAPTCHA.NOISE;
                                        options.size = captchaSetup.MATHCAPTCHA.SIZE;
                                        var captcha = SmoothCaptcha.createMathExpr(options);
                                    } else if (CaptchaType == 'ALPHANUMCAPTCHA') {
                                        options.noise = captchaSetup.ALPHANUMCAPTCHA.NOISE;
                                        options.size = captchaSetup.ALPHANUMCAPTCHA.LENGTH;
                                        options.ignoreChars = captchaSetup.ALPHANUMCAPTCHA.IGNORE_CHARS;
                                        var captcha = SmoothCaptcha.create(options);
                                    } else if (CaptchaType == 'NUMBERCAPTCHA') {
                                        options.noise = captchaSetup.NUMBERCAPTCHA.NOISE;
                                        var NumcaptchaLenth = captchaSetup.NUMBERCAPTCHA.LENGTH;
                                        // var randomNumber = Math.floor(Math.random() * Math.pow(9, NumcaptchaLenth)).toString();

                                        // //to Generarte Randome Number 
                                        function randomIntInc(low, high) {
                                            return Math.floor(Math.random() * (high - low + 1) + low);
                                        }
                                        var arrRandomNum = new Array(NumcaptchaLenth);
                                        for (var Randomnumlength = 0; Randomnumlength < arrRandomNum.length; Randomnumlength++) {
                                            arrRandomNum[Randomnumlength] = randomIntInc(1, 9);
                                        }

                                        var randomNumber = arrRandomNum.toString().replace(/,/g, '');

                                        var captcha = {};
                                        captcha.text = randomNumber;
                                        captcha.data = SmoothCaptcha(randomNumber, options);
                                    } else if (CaptchaType == 'reCAPTCHA') {
                                        captchaDetail.CLIENT_SITE_KEY = captchaSetup.reCAPTCHA.CLIENT_SITE_KEY;
                                        captchaDetail.SERVER_SECRET_KEY = captchaSetup.reCAPTCHA.SERVER_SECRET_KEY;
                                        captchaDetail.THEME = captchaSetup.reCAPTCHA.THEME;
                                        response.Captcha = captchaDetail;
                                    }
                                    if (CaptchaType != 'reCAPTCHA') {
                                        var captchahtml = '<!doctype html>\n<html lang="en">\n' +
                                            '\n<meta charset="utf-8">\n' +
                                            '<style type="text/css">* {font-family:arial, sans-serif;}</style>\n' +
                                            '<div id="content">' + captcha.data + '<input type="text" autocomplete = "nope" name="captacha"  />' + '</div>' +
                                            '\n\n';
                                        //response.Captchadata = captcha.text;
                                        //response.html = captchahtml;
                                        captchaDetail.Captchadata = captcha.text;
                                        captchaDetail.html = captchahtml;
                                        response.Captcha = captchaDetail;
                                    }
                                } else {
                                    captchaDetail.NEED_CAPTCHA = 'N';
                                    response.Captcha = captchaDetail;
                                }
                            } else if (pResult[i].category == 'SIGNUP_URL') {
                                //Get signup url for login page
                                var SignUpUrlSetp = JSON.parse(pResult[i].setup_json);
                                captchaDetail.SIGNUP_LABEL = SignUpUrlSetp.SIGNUP_LABEL;
                                captchaDetail.SIGNUP_URL = SignUpUrlSetp.SIGNUP_URL;
                            } else if (pResult[i].category == 'LOGIN_PAGE_DETAIL') {
                                var LoginDetail = {};
                                //Get Login Page Details
                                var SetupJson = JSON.parse(pResult[i].setup_json);
                                LoginDetail.LOGIN_ICON = SetupJson.LOGIN_ICON;
                                LoginDetail.LOGIN_ICON_HEADER = SetupJson.LOGIN_ICON_HEADER;
                                LoginDetail.LOGIN_HEADER = SetupJson.LOGIN_HEADER;
                                LoginDetail.NEED_LANG = SetupJson.NEED_LANGUAGE;
                                LoginDetail.NEED_LOGOUT_CONFIRM = SetupJson.NEED_LOGOUT_CONFIRM;
                                response.LOGINDETAIL = LoginDetail;
                            }
                        }
                        if (pHeaders['salt-session']) {
                            var redissaltkey = pHeaders['salt-session'];
                            get_salt_value(redissaltkey, function (res) {
                                if (res) {
                                    reqRedisInstance.GetRedisConnectionwithIndex(2, function (error, RedisSession) {
                                        InsertSaltintoRedis(RedisSession, redissaltkey, res.salt, response.Captcha);
                                        delete response.Captchadata
                                        return callback(null, response);
                                    });
                                }
                            });

                        } else {
                            return callback(null, response);
                        }
                    } else {
                        return callback(null, 'No data found');
                    }


                } catch (error) {
                    return callback('Exception occured ' + error, null);
                }
            }
        });
    } catch (error) {
        return callback('Exception occured ' + error, null);
    }
}

function getEnvCode(callback) {
    try {
        var pServiceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (pServiceModel && pServiceModel.MODE) {
            callback(null, pServiceModel.MODE);
        } else {
            callback(null, null);
        }
    } catch (error) {
        callback(error);
    }
}

function ldapAuthentication(userName, password, ldapClient, LDAP_OU, LDAP_LOGIN_ID, LDAP_PASSWORD, LDAP_FILTER_ATTRIBUTE) {
    try {
        return new Promise((resolve, reject) => {
            // calling method get_CN_for_exisiting_user_in_ActiveDirectory
            get_CN_for_exisiting_user_in_ActiveDirectory(userName, ldapClient, LDAP_OU, LDAP_LOGIN_ID, LDAP_PASSWORD, LDAP_FILTER_ATTRIBUTE, function (userDetails) {
                var result = {};
                if (userDetails.userExist) {
                    // get cn from userdetails
                    var cn = userDetails.cn;

                    // authenticate user with cn and password
                    authenticate_user_with_ldap(cn, password, ldapClient, function (authentication, error) {
                        if (authentication) {
                            result.userstatus = true;
                            result.message = "User Authenticated Successfully";
                        } else {
                            result.userstatus = false;
                            result.message = error;
                        }
                        resolve(result);
                    });
                } else {
                    result.userstatus = false;
                    result.message = "User Name Incorrect";
                    resolve(result);
                }
            });
        })
    } catch (error) {
        reject(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14804', 'GetTableFromFXDB USERS Failed', error));
    }
}

function get_CN_for_exisiting_user_in_ActiveDirectory(userName, ldapClient, LDAP_OU, LDAP_LOGIN_ID, LDAP_PASSWORD, LDAP_FILTER_ATTRIBUTE, callback) {
    try {
        // bind for windows server
        ldapClient.bind(LDAP_LOGIN_ID, LDAP_PASSWORD, function (err) {
            // create search options for LDAP search
            var search_options = {
                filter: '(' + LDAP_FILTER_ATTRIBUTE + '=' + userName + ')',
                scope: 'sub',
            };
            // end result
            var data = {};
            //search client in AD
            // AD_ORGANIZATION_PATH - Active directory path of organization
            ldapClient.search(LDAP_OU, search_options, function (err, resp) {
                try {
                    resp.on('searchEntry', function (entry) {
                        try {
                            data.cn = entry.objectName;
                            data.userExist = true;
                            data.error = "";
                        } catch (error) {
                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14805', 'GetTableFromFXDB USERS Failed', error));
                        }
                    });
                    resp.on('page', function (result) {
                        try {
                            //console.log('page end');
                        } catch (error) {
                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14806', 'GetTableFromFXDB USERS Failed', error));
                        }
                    });
                    resp.on('error', function (resErr) {
                        try {
                            data.cn = "";
                            data.userExist = false;
                            data.error = resErr;
                        } catch (error) {
                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14807', 'GetTableFromFXDB USERS Failed', error));
                        }
                    });
                    resp.on('end', function (result) {
                        try {
                            callback(data);
                        } catch (error) {
                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14808', 'GetTableFromFXDB USERS Failed', error));
                        }
                    });
                } catch (error) {
                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14809', 'GetTableFromFXDB USERS Failed', error));
                }
            });
        });
    } catch (error) {
        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14810', 'GetTableFromFXDB USERS Failed', error));
    }
};

function authenticate_user_with_ldap(userName, password, ldapClient, callback) {
    try {
        //console.log("UNAME" + userName);
        var authentication = true;

        ldapClient.bind(userName, password, function (error) {
            if (error) {
                authentication = false;
            }
            callback(authentication, error);
        });
    } catch (error) {
        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14811', 'GetTableFromFXDB USERS Failed', error));
    }
};

// Get login setup from redis and tenant_setup
function getLoginConfig(headers, params, objLogInfo, callback) {
    try {
        var strClientID = params.CLIENT_ID;
        var strTenantID = params.TENANT_ID;
        var ldap_key = 'LDAP';
        var ldapredisKey = ldap_key + '~' + defaultRedisKey.toUpperCase();
        if (headers && headers.routingkey) {
            ldapredisKey = ldap_key + '~' + headers.routingkey.toUpperCase();
        }
        var redisvalue = '';
        var config_parsed = {};
        reqInstanceHelper.GetConfig(ldapredisKey, function (ldap_result) {
            try {
                console.log(ldapredisKey + " result is : " + ldap_result);
                if (ldap_result) {
                    config_parsed = JSON.parse(ldap_result);
                    callback(Ldap_result(config_parsed));
                } else {
                    reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (pClient) {
                        try {
                            if (ldapredisKey.indexOf(defaultRedisKey) == -1) {
                                ldapredisKey = ldap_key + '~' + defaultRedisKey.toUpperCase();
                                reqInstanceHelper.GetConfig(ldapredisKey, function (ldap_result) {
                                    try {
                                        console.log(ldapredisKey + " result is : " + ldap_result);
                                        if (ldap_result) {
                                            config_parsed = JSON.parse(ldap_result);
                                            //config_parsed.NEED_LDAP_VERIFICATION = "Y";//remove this line
                                            callback(Ldap_result(config_parsed));
                                        } else {
                                            doWithDB(pClient);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                    }
                                });
                            } else {
                                doWithDB(pClient);
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                        }
                    });
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            }
        });

        function doWithDB(pClient) {
            try {
                var strInputParamJson = {};
                reqDBInstance.GetTableFromFXDB(pClient, 'tenant_setup', [], {
                    client_id: strClientID,
                    tenant_id: strTenantID,
                    category: 'LDAP_INFO'
                }, objLogInfo, function callbackselTENANTSETUP(err, TENANTRES) {
                    try {
                        if (err)
                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14802', 'GetTableFromFXDB USERS Failed', err));
                        else {
                            if (TENANTRES.rows[0]) {
                                strInputParamJson = TENANTRES.rows[0].setup_json;
                                doRedisEntry();
                            } else {
                                reqDBInstance.GetTableFromFXDB(pClient, 'tenant_setup', [], {
                                    client_id: '0',
                                    tenant_id: '0',
                                    category: 'LDAP_INFO'
                                }, objLogInfo, function callbackselTENANTSETUP(err, TENANTRES) {
                                    try {
                                        if (err)
                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14802', 'GetTableFromFXDB USERS Failed', err));
                                        else {
                                            strInputParamJson = TENANTRES.rows[0].setup_json;
                                            doRedisEntry();
                                        }
                                    } catch (error) {
                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14847', 'Querying  tenant_setup table callback function  Failed', error));
                                    }
                                });
                            }

                            function doRedisEntry() {
                                try {
                                    reqInstanceHelper.GetRedisKey(ldap_key, headers['routingkey'], function (redisKey) {
                                        reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                                            try {
                                                if (result) {
                                                    redisvalue = redisKey;
                                                } else {
                                                    redisvalue = ldapredisKey;
                                                }
                                                reqRedisInstance.GetRedisConnection(function (error, clientR) {
                                                    try {
                                                        clientR.set(redisvalue, strInputParamJson);
                                                        clientR.bgsave();
                                                        clientR.get(redisvalue, function (error, res) {
                                                            config_parsed = res;
                                                            callback(Ldap_result(config_parsed));
                                                        });
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                                    }
                                                });
                                            } catch (error) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                            }
                                        });
                                    });
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                }
                            }
                        }
                    } catch (error) {
                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14847', 'Querying  tenant_setup table callback function  Failed', error));
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            }
        }
    } catch (error) {
        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14803', 'GetTableFromFXDB USERS Failed', error));
    }
}

function Ldap_result(config_parsed) {
    try {
        var result = {};
        result.NEED_LDAP_VERIFICATION = config_parsed.NEED_LDAP_VERIFICATION;
        if (config_parsed && config_parsed.NEED_LDAP_VERIFICATION === 'Y') {
            result.status = true;
            result.data = config_parsed.LDAP_CONFIG;
            result.message = "LDAP_CONFIGURED";
        } else {
            result.status = false;
            result.message = "LDAP_NOT_CONFIGURED";
        }
        return result;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}


function get_salt_value(Slat, saltcallback) {
    reqRedisInstance.GetRedisConnectionwithIndex(2, async function (error, clientR) {
        try {
            var saltRes = {};
            if (Slat) {
                // clientR.get(Slat, function (err, object) {
                var resObject = await clientR.get(Slat)
                if (resObject) {
                    var Capsalt = JSON.parse(resObject);
                    saltcallback(Capsalt, '');
                } else {
                    saltRes.message = 'Session Not available';
                    saltcallback(saltRes, '');
                }
                // });
            } else {
                decrypted = reqEncHelper.DecryptPassword(strPwd);
                saltRes.strPwd = decrypted;
                saltcallback(saltRes);
            }
        } catch (error) {
            saltcallback('', error);
        }
    });
}


function DeleteSaltSession(serviceNmae, objLogInfo, SALTKEY) {
    reqRedisInstance.GetRedisConnectionwithIndex(2, function (error, clientR) {
        clientR.del(SALTKEY, function (err, reply) {
            if (err) {
                reqInstanceHelper.PrintError(serviceNmae, objLogInfo, 'ERR-REF-10843', 'err occured while delete salt key', err);
            } else {
                reqInstanceHelper.PrintInfo(serviceName, 'Slat cleared successfully', objLogInfo);
            }
        });
    });

}

//Commin Result  Preparation
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject, ProcessStatus, INfoMessage) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject,
        'PROCESS_STATUS': ProcessStatus,
        'INFO_MESSAGE': INfoMessage
    };
    return obj;
}

module.exports = {
    GetLoginPageInfo: getLoginPageInfo,
    GetCaptcha: getCaptcha,
    LdapAuthentication: ldapAuthentication,
    GetLoginConfig: getLoginConfig,
    PrepareSlat: PrepareSlat,
    get_salt_value: get_salt_value,
    DeleteSaltSession: DeleteSaltSession,
    getEnvCode: getEnvCode

};