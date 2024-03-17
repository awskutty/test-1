/*Created by Venkatr*/

// require depencies
var modPath = '../../../../node_modules/'
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLINQ = require(modPath + "node-linq").LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
//cassandra Instance 
var mClient = '';
var pHeaders = '';
//Query Preparation
const CLIENTQUERY = 'select u_id,login_name,role,allocated_ip,double_authentication,double_authentication_model,email_id,first_name,last_name,middle_name,mobile_no,session_timeout from users'

//Service Call
router.post('/GetAPUsers', function (req, resp) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    objLogInfo.PROCESS = 'GetAPUsers-Authentication';
    objLogInfo.ACTION = 'GetAPUsers';
    reqLogWriter.Eventinsert(objLogInfo);

    try {
        pHeaders = req.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            //reqCasInstance.GetCassandraConn(pHeaders, 'plt_cas', function Callback_GetCassandraConn(pClient) {
            mClient = pClient;

            reqLogWriter.TraceInfo(objLogInfo, 'GetAPUsers called...');
            var is_search = req.body.IS_SEARCH;
            var searchval = req.body.USER_SEARCH;
            var arrusers = [];
            var objusers = {};
            var userrow = [];

            //Function call
            GetAPUsers();

            //Main Function declaration
            function GetAPUsers(pclientParams) {
                try {
                    DBInstance.GetTableFromFXDB(mClient, 'users', [u_id, login_name, role, allocated_ip, double_authentication, double_authentication_model, email_id, first_name, last_name, middle_name, mobile_no, session_timeout], {}, objLogInfo, function callbackClientQry(pErr, pResult) {
                        // mClient.execute(CLIENTQUERY, [], {
                        //     prepare: true
                        // }, function callbackClientQry(pErr, pResult) {
                        try {
                            if (pErr)
                                reqLogWriter.TraceError(objLogInfo, pErr, "ERR-FX-10129");

                            else {
                                //    var is_search = pclientParams.IS_SEARCH;
                                if (is_search == 'Y') {
                                    //LINQ query to filter the serached items
                                    userrow = new reqLINQ(pResult.rows)
                                        .Where(function (u) {
                                            return u.login_name.toUpperCase().startsWith(searchval.toUpperCase())
                                        }).ToArray();
                                } else {
                                    userrow = pResult.rows;
                                }
                                //Prepare JSON
                                for (i = 0; i < userrow.length; i++) {
                                    var objuser = {};
                                    objuser.U_ID = userrow[i].u_id;
                                    objuser.LOGIN_NAME = userrow[i].login_name;
                                    objuser.ROLE = userrow[i].role;
                                    objuser.ALLOCATED_IP = userrow[i].allocated_ip;
                                    objuser.DOUBLE_AUTHENTICATION = userrow[i].double_authentication;
                                    objuser.DOUBLE_AUTHENTICATION_MODEL = userrow[i].double_authentication_model;
                                    objuser.EMAIL_ID = userrow[i].email_id;
                                    objuser.FIRST_NAME = userrow[i].first_name;
                                    objuser.LAST_NAME = userrow[i].last_name;
                                    objuser.MIDDLE_NAME = userrow[i].middle_name;
                                    objuser.MOBILE_NO = userrow[i].mobile_no;
                                    objuser.SESSION_TIMEOUT = userrow[i].session_timeout;
                                    arrusers.push(objuser);
                                }
                                objusers.USERS = arrusers;

                                reqLogWriter.TraceInfo(objLogInfo, 'APUsers Loaded successfully...');
                                reqLogWriter.EventUpdate(objLogInfo);
                                resp.send(JSON.stringify(objusers));
                                //console.log(objusers);
                            }

                        } catch (error) {
                            errorHandler("ERR-FX-10129", "Error GetAPUsers function" + error)
                        }
                    })
                } catch (error) {
                    errorHandler("ERR-FX-10128", "Error GetAPUsers function" + error)
                }
            }
        })
    } catch (error) {
        errorHandler("ERR-FX-10127", "Error GetAPUsers function" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
})


module.exports = router;