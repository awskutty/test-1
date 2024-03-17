/*
@Description : Helper file for LDAP 
*/

var node_modules = '../../../../../node_modules/'
var referenceRoot = '../../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()

var ldap = require(node_modules + 'ldapjs');
const { reject } = require('lodash');
const { resolve } = require('path');
// var appHelper = require('../../../../../torus-references/instance/AppHelper');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');

var LDAP_URL = "";
var LDAP_OU = "";
var LDAP_LOGIN_ID = "";
var LDAP_PASSWORD = "";
var LDAP_FILTER_ATTRIBUTE = "";
var ldapClient = "";
var redis_key = "LDAP";
var serviceName = 'LdapUserListing';
var objLogInfo = {};

function listLdapUsers(mHeaders, objLog, searchname, callback) {
    objLogInfo = objLog;
    reqInstanceHelper.PrintInfo(serviceName, "Getting value from redis", objLogInfo)
    reqInstanceHelper.GetRedisValue(redis_key, mHeaders, async function CallbackGetCassandraConn(ldap_result) {
        //reqInstanceHelper.GetConfig(redis_key + mHeaders.routingkey, function (ldap_result) {
        var config_parsed = {};
        var result = {};

        if (ldap_result) {
            config_parsed = JSON.parse(ldap_result);
            LDAP_URL = [];
            var config_parse = config_parsed.LDAP_CONFIG;
            // var splitedLoginID = config_parsed.LDAP_CONFIG.LOGIN_ID.split(";")
            //var splitOU = config_parsed.LDAP_CONFIG.OU.split(";")
            if (!config_parse.length) {
                config_parse = [config_parse]
            }
            var resData = []
            for (var i = 0; i < config_parse.length; i++) {
                LDAP_URL = "ldap://" + config_parse[i].SERVER.trim() + ":" + config_parse[i].PORT;
                LDAP_OU = config_parse[i].OU;
                LDAP_LOGIN_ID = config_parse[i].LOGIN_ID;
                LDAP_PASSWORD = config_parse[i].PASSWORD;
                LDAP_FILTER_ATTRIBUTE = config_parse[i].FILTER_ATTRIBUTE;


                var resp = {};
                // initialize ldapClient
                ldapClient = ldap.createClient({
                    url: LDAP_URL
                });

                // for (var i = 0; i < config_parse.length; i++) {
                //Get LDAP users of specified organization
                var response = await get_Ldap_Users()
                //    function (response) {
                if (response.STATUS === "FAILURE") {
                    callback(response);

                } else {
                    if (response.SUCCESS_DATA.data.length) {
                        for (var j = 0; j < response.SUCCESS_DATA.data.length; j++) {
                            resData.push(response.SUCCESS_DATA.data[j])
                        }
                    }
                    ldapClient.unbind(function (err) {
                        if (err) {
                            reqInstanceHelper.PrintInfo(serviceName, "LDAP unbind failed due to " + err, objLogInfo)
                        }
                    });
                    // resp.filter_attribute = LDAP_FILTER_ATTRIBUTE;
                    // resp.users = response
                    // callback(sendMethodResponse("SUCCESS", "", resp, "", "", ""))
                }
                // });
            }

            resp.filter_attribute = LDAP_FILTER_ATTRIBUTE;
            resp.users = resData
            resp.users.STATUS = 'SUCCESS'
            callback(sendMethodResponse("SUCCESS", "", resp, "", "", ""))
        }


    });
    // get_Ldap_Users = function (callback) {


    async function get_Ldap_Users() {
        return new Promise((resolve, reject) => {
            // create search options for LDAP search
            if (searchname) {
                var search_options = {
                    filter: '(' + LDAP_FILTER_ATTRIBUTE + '=*' + searchname + '*' + ')',
                    // filter: '(' + LDAP_FILTER_ATTRIBUTE + '=*)',
                    scope: 'sub',
                    paged: {
                        pageSize: 20,
                        pagePause: true
                    }
                };


                ldapClient.bind(LDAP_LOGIN_ID, LDAP_PASSWORD, function (error) {
                    if (error) {
                        resolve(sendMethodResponse("FAILURE", "", "", "ERR-MIN-50202", "LDAP Binding Error", error))
                    } else {
                        //search client in AD
                        ldapClient.search(LDAP_OU, search_options, function (error, resp) {
                            if (error) {
                                resolve(sendMethodResponse("FAILURE", "", "", "ERR-MIN-50203", "No Data Found", error))
                            } else {
                                resp.on('searchEntry', function (entry) {

                                    // Loop through entry object and form a json object with name and uid of users
                                    for (var val in entry.attributes) {
                                        var data = {};
                                        if (entry.attributes[val].type === LDAP_FILTER_ATTRIBUTE) {
                                            data.name = entry.objectName;
                                            data[LDAP_FILTER_ATTRIBUTE] = entry.attributes[val].vals[0];
                                            response.push(data);
                                        }

                                    }

                                });
                                resp.on('page', function (result) {

                                });
                                resp.on('error', function (resErr) {
                                    response.error = {};
                                    response.error.data = resErr;

                                    output.status = false;
                                    output.data = response;
                                    resolve((sendMethodResponse("FAILURE", "", "", "ERR-MIN-50204", "No Data Found", JSON.stringify(output))))
                                });
                                resp.on('end', function (result) {
                                    output.status = true;
                                    output.data = response;
                                    // callback(sendMethodResponse("SUCCESS", "", output, "", "", ""))
                                    resolve(sendMethodResponse("SUCCESS", "", output, "", "", ""))
                                });
                            }
                        });
                    }
                });

            } else {
                var output = {};
                output.status = true;
                output.data = [];
                callback(sendMethodResponse("SUCCESS", "", output, "", "", ""))

            }

            // end result
            var response = [];
            var output = {};


        })
    };
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
    listLdapUsers: listLdapUsers
}