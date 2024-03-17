/*
@Description : Compare LDAP users with cassandra users and flag them if they are added and save them to redis 
*/

var node_modules = '../../../../../node_modules/'
var referenceRoot = '../../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router();
var ldap_helper = require('./LdapHelper');
var async = require(node_modules + 'async');
var redis_key_for_ldap_user_save = "LDAP_USER_DETAIL";
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
const { concat } = require('lodash');
var serviceName = 'LdapUserListing';
var objLogInfo = {};

function getLdapUsers(pClient, mHeaders, PCLIENT_ID, objLog, filter, final_callback) {
    objLogInfo = objLog

    // var App_id = objSessionInfo.APP_ID;
    var mClient = pClient;
    var result = [];
    var cassandra_users = [];
    var ldap_users = [];
    var filter_attribute = "";
    var status = "";
    var output = {};
    var searchname = filter;
    reqInstanceHelper.PrintInfo(serviceName, 'listldapUsers method Called', objLogInfo)
    ldap_helper.listLdapUsers(mHeaders, objLogInfo, searchname, function (ldap_users_response) {
        if (ldap_users_response.STATUS === "SUCCESS") {
            ldap_users_response = ldap_users_response.SUCCESS_DATA;
            if (ldap_users_response.users.STATUS == "SUCCESS") {
                ldap_users = ldap_users_response.users;
                filter_attribute = ldap_users_response.filter_attribute;
                reqInstanceHelper.PrintInfo(serviceName, 'Started async processing', objLogInfo);
                var ldapUsers = [];
                for (var i = 0; i < ldap_users.length; i++) {
                    var userName = ldap_users[i][filter_attribute];
                    ldapUsers.push(userName.toUpperCase().trim());
                }
                reqInstanceHelper.PrintInfo(serviceName, 'calling compareandflag_ldapUsers_and_cassandraUsers method', objLogInfo)
                compareandflag_ldapUsers_and_cassandraUsers(ldapUsers, PCLIENT_ID, objLogInfo, function (response) {
                    if (response["STATUS"] === 'FAILURE') {
                        reqInstanceHelper.PrintInfo(serviceName, response["ERROR_OBJECT"], objLogInfo);
                        final_callback(sendMethodResponse("FAILURE", "", "", response.ERROR_CODE, response.ERROR_MESSAGE, response["ERROR_OBJECT"]))
                    } else {
                        var dbUsers = response["SUCCESS_DATA"];
                        if (ldap_users.length) {
                            var allUsers = []
                            var ldapUsersavailDB = [];
                            var ldapUsernotinDB = []
                            for (var l = ldap_users.length - 1; l >= 0; l--) {
                                var ldapUser = ldap_users[l];
                                ldapUser.u_id = "";
                                ldapUser.app_id = "";
                                ldapUser.appu_id = "";
                                // var filterUser = dbUsers.filter((dbuser) => {
                                //     return ldapUser[filter_attribute].toUpperCase().trim() == dbuser.login_name;
                                // })

                                if (dbUsers.length) {
                                    var idx = dbUsers.findIndex((element) => element.login_name === ldapUser[filter_attribute].toUpperCase().trim());

                                    if (idx > -1) {
                                        ldapUser.u_id = dbUsers[idx].u_id;
                                        ldapUser.app_id = dbUsers[idx].app_id;
                                        ldapUser.appu_id = dbUsers[idx].appu_id;
                                        dbUsers.splice(idx, 1);
                                        ldapUser.flag = "Y";
                                        ldapUsersavailDB.push(ldapUser)
                                    } else {
                                        ldapUser.flag = "N";
                                        ldapUsernotinDB.push(ldapUser)
                                    }
                                } else {
                                    ldapUser.flag = "N";
                                    ldapUsernotinDB.push(ldapUser)
                                }


                                // for (var usr = 0; usr < dbUsers.length; usr++) {
                                //     ldapUser.u_id = dbUsers[usr].u_id;
                                //     ldapUser.app_id = dbUsers[usr].app_id;
                                //     ldapUser.appu_id = dbUsers[usr].appu_id;
                                //     if (ldapUser[filter_attribute].toUpperCase().trim() == dbUsers[usr].login_name) {
                                //         dbUsers.splice(usr, 1)
                                //         ldapUser.flag = "Y";
                                //         ldapUsersavailDB.push(ldapUser)
                                //         break;
                                //     }

                                //     // else {
                                //     //     ldapUser.flag = "N";
                                //     //     ldapUsernotinDB.push(ldapUser)
                                //     // }
                                // }
                            }

                            // allUsers.push(ldapUsersavailDB, ldapUsernotinDB)
                            allUsers = ldapUsersavailDB.concat(ldapUsernotinDB)

                            for (var k = 0; k < dbUsers.length; k++) {
                                var objDBuser = {}
                                objDBuser[filter_attribute] = dbUsers[k].login_name;
                                objDBuser.u_id = dbUsers[k].u_id;
                                objDBuser.app_id = dbUsers[k].app_id;
                                objDBuser.appu_id = dbUsers[k].appu_id;
                                objDBuser.flag = dbUsers[k].flag;
                                allUsers.push(objDBuser)
                            }
                            final_callback(sendMethodResponse("SUCCESS", "", allUsers, "", "", ""));
                        }
                        else {
                            var finalDbUser = [];

                            for (var i = 0; i < dbUsers.length; i++) {
                                var objfinalDbUser = {}
                                objfinalDbUser[filter_attribute] = dbUsers[i].login_name;
                                objfinalDbUser['flag'] = dbUsers[i].flag;
                                objfinalDbUser['app_id'] = dbUsers[i].app_id;
                                objfinalDbUser['appu_id'] = dbUsers[i].appu_id;
                                objfinalDbUser['u_id'] = dbUsers[i].u_id;
                                finalDbUser.push(objfinalDbUser)

                            }
                            final_callback(sendMethodResponse("SUCCESS", "", finalDbUser, "", "", ""));
                        }
                    }
                });
            } else {
                final_callback(sendMethodResponse("FAILURE", "", "", "ERR-MIN-50206", "No users found ", ""));
            }
        }
        else {
            final_callback(ldap_users_response);
        }
    });


    compareandflag_ldapUsers_and_cassandraUsers = function (ldap_user_id, PCLIENT_ID, objLogInfo, callback) {
        var response = {
            app_id: "",
            appu_id: "",
            u_id: "",
            login_name: ""
        };
        var flag = '';
        var selectquery = {
            query:`select * from users where client_id =?  and is_external='Y' and status<>'DELETED'`,
            params:[PCLIENT_ID]
        }
        reqFXDBInstance.ExecuteSQLQueryWithParams(mClient, selectquery,objLogInfo,
          function callbackDelete(pResult,error) {
            if (error) {
                callback(sendMethodResponse("FAILURE", "", "", "", "", error));
            } else if (pResult) {
                try {
                    if (pResult.rows.length > 0 && pResult.rows[0].u_id != "") {
                        flag = (parseInt(pResult.rows.length) === 0) ? 'N' : 'Y';
                        var uIds = [];
                        var users = [];
                        for (var i = 0; i < pResult.rows.length; i++) {
                            var user = pResult.rows[i];
                            uIds.push(user.u_id);
                            users.push(user);
                        }
                        response.flag = flag;
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_users', [], {
                            u_id: uIds
                        }, null, function (error, respon) {
                            if (error) {
                                callback(sendMethodResponse("FAILURE", "", "", "", "", error));
                            } else if (respon) {
                                if (respon.rows.length > 0) {
                                    var responseArr = [];
                                    for (var u = 0; u < users.length; u++) {
                                        var user = users[u];
                                        var resData = {};
                                        for (var j = 0; j < respon.rows.length; j++) {
                                            var app_user = respon.rows[j];
                                            if (user.u_id == app_user.u_id) {
                                                resData.u_id = user.u_id;
                                                resData.login_name = user.login_name;
                                                resData.appu_id = app_user.appu_id;
                                                resData.app_id = app_user.app_id;
                                                resData.flag = 'Y';
                                                responseArr.push(resData);
                                                break;
                                            } else if (u == users.length) {
                                                resData.u_id = user.u_id;
                                                resData.login_name = user.login_name;
                                                resData.flag = 'N';
                                                responseArr.push(resData);
                                            }
                                        }
                                    }
                                    callback(sendMethodResponse("SUCCESS", "", responseArr, "", "", ""));
                                } else {
                                    callback(sendMethodResponse("FAILURE", "", [response], "", "", ""));
                                }

                            }

                        })

                    } else {
                        callback(sendMethodResponse("SUCCESS", "", response, "", "", ""));
                    }
                } catch (error) {
                    console.log("error in compareandflag_ldapUsers_and_cassandraUsers ------------------------->" + error);
                    callback(sendMethodResponse("FAILURE", "", [], "ERR-MIN-50226", "MException occured", error));
                }
            }

        });
    }


    saveLdapUserToRedis = function (result, callback) {
        var response = {};
        reqRedisInstance.GetRedisConnection(function (error, clientR) {
            if (error) {
                response.status = false;
                response.message = error;
                callback(response);
            } else {
                clientR.set(redis_key_for_ldap_user_save, result, function (err) {
                    if (err) {
                        response.status = false;
                        response.message = err;
                        callback(response);
                    } else {
                        response.status = true;
                        callback(response);
                    }
                });
            }
        });
    }

}

function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    }
    return obj
}


module.exports = {
    getLdapUsers: getLdapUsers
}