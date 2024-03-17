var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqProducer = require('../../../../torus-references/common/Producer');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var router = reqExpress.Router();
//var reqMoment = require('moment');
// Cassandra initialization
// var mPltClient = reqCasInstance.SessionValues['plt_cas'];
// var mCltClient = reqCasInstance.SessionValues['clt_cas'];

const PCLIENT = 'select *  from clients where email_id=? allow filtering';
const USERUPD = "update fx_total_items set counter_value = counter_value + 1 where code='CLIENTS'";
const CLIENTSCOUNT = 'select counter_value from fx_total_items where code=?';
const CLNTINS = 'insert into clients(client_id,client_name,client_password,mobile_no,email_id,is_free,organisation_name,created_date) values(?,?,?,?,?,?,?,?)';
const CLIENTSETUP = 'select * from platform_setup where code = ?';


// Host the login api
router.post('/DoPlatformClientSignUp', function(pReq, pResp, pNext) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'DoPlatformClientSignUp-Authentication';
    objLogInfo.ACTION = 'DoPlatformClientSignUp';
    reqLogWriter.Eventinsert(objLogInfo);
    var mPltClient = '';


    try {
        pResp.setHeader('Content-Type', 'application/json');
        //Initialize the variables
        var pFirstName = pReq.body.firstName;
        var pEmail = pReq.body.email.toUpperCase();
        var pPassword = pReq.body.password;
        var pOrganisation = pReq.body.organisation;
        var pMobile = pReq.body.mobile;
        var pIsfree = pReq.body.isFree;
        var pClienturl = pReq.headers.origin + pReq.originalUrl; //noted
        var strRes = '';
        var UniqueclientId;
        DoPlatformClientSignUp();

        function DoPlatformClientSignUp() {
            try {
                DBInstance.GetFXDBConnection(pReq.headers, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(PltClientSession) {
                    mPltClient = PltClientSession;
                    reqLogWriter.TraceInfo(objLogInfo, ' DoPlatformClientSignUp Success...');
                    DBInstance.GetTableFromFXDB(mPltClient, 'clients', [], {
                        'email_id': pEmail
                    }, objLogInfo, function callbackpclient(err, result) {
                        // mPltClient.execute(PCLIENT, [pEmail], {
                        //     prepare: true
                        // }, function callbackpclient(err, result) {
                        if (err) {
                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10118");
                        } else {
                            if (result.rows.length > 0) {
                                strRes = 'Email Id Already Registered';
                                reqLogWriter.TraceInfo(objLogInfo, pEmail + ' Already Registered...');
                                reqLogWriter.EventUpdate(objLogInfo);
                                pResp.send(JSON.stringify(strRes));
                            } else {
                                AddClient(mPltClient);
                            }
                        }
                    });
                });
            } catch (error) {
                errorHandler("ERR-FX-10118", "Error DoPlatformClientSignUp function" + error)
            }
        }
        DoPlatformClientSignUp

        //Prepare adding as a client user
        function AddClient(mPltClient) {
            try {
                DBInstance.ExecuteQuery(mPltClient, USERUPD, objLogInfo, function callbackaddclient(err) {
                    // mPltClient.execute(USERUPD, ['CLIENTS'], {
                    //     prepare: true
                    // }, function callbackaddclient(err) {
                    try {
                        if (err) {
                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10117");
                        } else {
                            const CLIENTSCOUNT = 'select counter_value from fx_total_items where code=?';
                            DBInstance.GetTableFromFXDB(mPltClient, 'fx_total_items', ['counter_value'], {
                                'code': 'CLIENTS'
                            }, objLogInfo, function callbackclient(err, result) {
                                // mPltClient.execute(CLIENTSCOUNT, ['CLIENTS'], {
                                //     prepare: true
                                // }, function callbackclient(err, result) {
                                try {
                                    if (err) {
                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10117");
                                    } else {
                                        UniqueclientId = 0;
                                        for (var i = 0; i < result.rows.length; i++) {
                                            UniqueclientId = result.rows[0].counter_value.low;
                                            var strPwd = reqEncHelper.DecryptPassword(pPassword);
                                            var strPass = reqEncHelper.EncryptPassword(strPwd);
                                            DBInstance.InsertFXDB(mPltClient, 'clients', [{

                                                'client_id': UniqueclientId.toString(),
                                                'client_name': pFirstName,
                                                'client_password': strPass,
                                                'mobile_no': pMobile,
                                                'email_id': pEmail.toUpperCase(),
                                                'is_free': pIsfree,
                                                'organisation_name': pOrganisation,
                                                'created_date': reqDateFormater.GetTenantCurrentDateTime(pReq.headers, objLogInfo),

                                            }], objLogInfo, function(err, Iresult) {

                                                try {
                                                    if (err) {
                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10117");
                                                    } else {
                                                        //reqLogWriter.TraceInfo(objLogInfo, 'Client created in clients table');
                                                        ClientSetup(mPltClient);
                                                    }
                                                } catch (error) {
                                                    errorHandler("ERR-FX-10117", "Error DoPlatformClientSignUp function" + error)
                                                }
                                            })
                                        }
                                    }
                                } catch (error) {
                                    errorHandler("ERR-FX-10116", "Error DoPlatformClientSignUp function" + error)
                                }
                            })
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10115", "Error DoPlatformClientSignUp function" + error)
                    }
                })
            } catch (error) {
                errorHandler("ERR-FX-10114", "Error DoPlatformClientSignUp function" + error)
            }
        }


        //Prepare client setup for the respected user
        function ClientSetup(mPltClient) {
            try {
                var strpassword = '';
                DBInstance.GetTableFromFXDB(mPltClient, 'platform_setup', [], {
                    'code': 'CHT_USR_PWD'
                }, objLogInfo, function callbackclient(err, result) {
                    try {
                        if (err) {
                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10113");
                        } else {
                            if (result.rows.length > 0) {
                                for (var j = 0; j < result.rows.length; j++) {
                                    strpassword = result.rows[0].value;
                                    if (!strpassword) {
                                        var objssn = strpassword; //noted
                                        strpassword = objssn.CHT_USR_PWD; //noted
                                    }
                                    //RocketChatHelper.__CreateUser(cltcassandra, UniqueclientId, pEmail.toUpperCase(), pEmail, strpassword, UniqueclientId, "")
                                    pClienturl = pClienturl + "?key=" + UniqueclientId;
                                    var jobj = {};
                                    if (pIsfree == "N") {
                                        pClienturl = pClienturl.replace("DoPlatformClientSignUp", "ActivatePayAccount");
                                        jObj = GetCommTemplate("SIGNUP_PAYABLE_USR_TEMP", mPltClient, function callback(pTemplate) {
                                            try {
                                                var param = {};
                                                param.email_id = pEmail;
                                                param.mobile_no = pMobile;
                                                param.client_url = pClienturl;
                                                param.needurlreplace = 'Y';
                                                param.user_name = pFirstName;
                                                param.OTP = '';
                                                param.SMS_TEMPLATE = JSON.parse(pTemplate).SMS_TEMPLATE;
                                                param.MAIL_TEMPLATE = JSON.parse(pTemplate).MAIL_TEMPLATE;
                                                reqProducer.ProduceMessage('APCP_OTP', param, pReq.headers, function(response) {
                                                    try {
                                                        if (err) {
                                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10113");
                                                        } else {
                                                            if (response == "SUCCESS") {
                                                                reqLogWriter.TraceInfo(objLogInfo, ' Activation mail has beed sent to  ' + pEmail);
                                                                reqLogWriter.EventUpdate(objLogInfo);
                                                                pResp.send(JSON.stringify("SUCCESS"));
                                                            }
                                                        }
                                                    } catch (error) {
                                                        errorHandler("ERR-FX-10113", "Error DoPlatformClientSignUp function" + error)
                                                    }

                                                });
                                            } catch (error) {
                                                errorHandler("ERR-FX-101112", "Error DoPlatformClientSignUp function" + error)
                                            }
                                        });
                                    } else {
                                        reqLogWriter.TraceInfo(objLogInfo, 'Free Accout sign up process');
                                        pClienturl = pClienturl.replace("DoPlatformClientSignUp", "ActivateFreeAccount");
                                        jObj = GetCommTemplate("SIGNUP_FREE_USR_TEMP", mPltClient, function callback(pTemplate) {
                                            try {
                                                var param = {};
                                                param.email_id = pEmail;
                                                param.mobile_no = pMobile;
                                                param.client_url = pClienturl;
                                                param.needurlreplace = 'Y';
                                                param.user_name = pFirstName;
                                                param.OTP = '';
                                                param.SMS_TEMPLATE = JSON.parse(pTemplate).SMS_TEMPLATE;
                                                param.MAIL_TEMPLATE = JSON.parse(pTemplate).MAIL_TEMPLATE;
                                                reqProducer.ProduceMessage('APCP_OTP', param, pReq.headers, function(response) {
                                                    try {
                                                        if (err) {
                                                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10111");

                                                        } else {
                                                            if (response == "SUCCESS") {
                                                                reqLogWriter.TraceInfo(objLogInfo, ' Activation mail has beed sent to  ' + pEmail);
                                                                reqLogWriter.EventUpdate(objLogInfo);
                                                                pResp.send(JSON.stringify("SUCCESS"));
                                                            }
                                                        }
                                                    } catch (error) {
                                                        errorHandler("ERR-FX-10111", "Error DoPlatformClientSignUp function" + error)
                                                    }
                                                });
                                            } catch (error) {
                                                errorHandler("ERR-FX-10110", "Error DoPlatformClientSignUp function" + error)
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10109", "Error DoPlatformClientSignUp function" + error)
                    }
                })
            } catch (error) {
                errorHandler("ERR-FX-10108", "Error DoPlatformClientSignUp function" + error)
            }
        }

        //Prepare coomunication template
        function GetCommTemplate(pCommCode, mPltClient, callback) {
            try {
                DBInstance.GetTableFromFXDB(mPltClient, 'platform_setup', [], {
                    'code': pCommCode
                }, objLogInfo, function callbackclient(err, result) {
                    try {
                        if (err) {
                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10107");
                        } else {
                            var pTemplate = result.rows[0];
                            return callback(pTemplate.value);
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10107", "Error DoPlatformClientSignUp function" + error)
                    }
                })
            } catch (error) {
                errorHandler("ERR-FX-10106", "Error DoPlatformClientSignUp function" + error)
            }
        }
    } catch (error) {
        errorHandler("ERR-FX-10105", "Error DoPlatformClientSignUp function" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }

});


module.exports = router;