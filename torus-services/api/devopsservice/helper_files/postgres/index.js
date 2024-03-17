
var FileSystem = require("fs");
var Path = require("path");
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var helper = require("../../helper");

const getDBInstance = function (pHeader, keyspace) {
    console.log("getDBInstance function called");
    return new Promise((resolve, reject) => {
        try {
            reqFXDBInstance.GetFXDBConnection(pHeader, keyspace, {}, function (Session) {
                if (Session) {
                    console.log(" schema: " + keyspace + " db instance get successfully ");
                    resolve(Session);
                } else {
                    console.log(" schema: " + keyspace + " db instance null value returned ");
                    reject(" schema: " + keyspace + " db instance null value returned ");
                }
            });
        } catch (err) {
            console.log(" schema: " + keyspace + " db instance error ");
            console.log(err.toString());
            reject(err.toString());
        }
    });
};

const getTranDBInstance = function (pHeaders) {
    console.log("getTranDBInstance function called");
    return new Promise((resolve, reject) => {
        try {
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                if (pSession) {
                    console.log(" schema: ad_gss_tran tran db instance get successfully ");
                    resolve(pSession);
                } else {
                    console.log(" schema: ad_gss_tran db instance null value returned ");
                    reject(" schema: ad_gss_tran db instance null value returned ");
                }

            });
        } catch (err) {
            console.log(" schema: ad_gss_tran tran db instance error ");
            console.log(err.toString());
            reject(err.toString());
        }
    });
};

async function CreateSchema(ClientParams) {
    console.log("CreateSchema function started");
    var header = ClientParams.headers;
    var DBName = ClientParams.DB_NAME;
    var createDBobj = {
        "query": "CREATE DATABASE " + DBName + " ENCODING 'UTF8' TEMPLATE template0;",
        "params": []
    };
    ClientParams.Schema["maindb_public"] = await getDBInstance(header, 'maindb_public');
    var sysSession = ClientParams.Schema["maindb_public"];
    await ExecuteQuery(sysSession, createDBobj);
    await ExecuteFileQuery(ClientParams, ClientParams.DatabaseFxPath, "ddl.sql");
    await ExecuteFileQuery(ClientParams, ClientParams.DatabaseFxPath, "dml.sql");
    console.log("CreateSchema function ended");
}

async function CreateDefaultEntries(ClientParams) {
    console.log("CreateDefaultEntries function started");
    var header = ClientParams.headers;
    var client_id = ClientId = ClientParams.CLIENT_ID;
    var tenant_id = ClientParams.TENANT_ID;
    ClientParams.Schema["clt_cas"] = await getDBInstance(header, 'clt_cas');
    var cltCasSession = ClientParams.Schema["clt_cas"];
    ClientParams.cltCasSession = cltCasSession;
    var UserId = await GetUserID(ClientParams);
    var BatchQueries = [];
    /*************TENENT SETUP ENTRY****************/
    var tenantSetupQueryObj = {
        "query": "select * from fx_setup_master",
        "params": []
    };
    var getTenantSetupSource = await ExecuteQuery(cltCasSession, tenantSetupQueryObj);
    if (getTenantSetupSource.qry_status == "SUCCESS") {
        var tenantSetupSource = [];
        getTenantSetupSource.rows.forEach((data) => {
            var tenantSetupEntry = {
                "CATEGORY": data.setup_code,
                "SETUP_JSON": data.setup_json,
            };
            tenantSetupSource.push(tenantSetupEntry);
        });
        tenantSetupSource.forEach(function (clientsetup) {
            BatchQueries.push({
                query: "insert into tenant_setup(client_id, tenant_id, category, created_by, created_date, description, modified_by, modified_date, setup_json, version) values(?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
                params: [client_id, tenant_id, clientsetup.CATEGORY, UserId, new Date(), clientsetup.CATEGORY, UserId, new Date(), clientsetup.SETUP_JSON]
            });
        });
    }

    /*************CLIENT SETUP ENTRY****************/
    var clientSetupQueryObj = {
        "query": "select * from client_setup_source",
        "params": []
    };
    var getClientSetupSource = await ExecuteQuery(cltCasSession, clientSetupQueryObj);
    if (getClientSetupSource.qry_status == "SUCCESS") {
        var clientSetupSource = [];
        getClientSetupSource.rows.forEach((data) => {
            var clientSetupEntry = {
                "CATEGORY": data.category,
                "SETUP_JSON": data.setup_json,
            };
            clientSetupSource.push(clientSetupEntry);
        });
        clientSetupSource.forEach(function (clientsetup) {
            BatchQueries.push({
                query: "insert into client_setup (client_id,category,description,setup_json) values (?,?,?,?)",
                params: [client_id, clientsetup.CATEGORY, clientsetup.CATEGORY, clientsetup.SETUP_JSON]
            });
        });
    }


    //Insert Systes Type
    var SystemTypeId = "1";
    var SystemTypeCode = "WP_DEFAULT";
    var SystemTypeDescription = "COMPANY";
    var strInsertSysType = "insert into system_types(st_id, created_by, created_date, st_category, st_code, st_description,client_id) values(?, ?, ?, ?, ?, ?, ?)";
    BatchQueries.push({
        query: strInsertSysType,
        params: [SystemTypeId, UserId, new Date(), SystemTypeCode, SystemTypeCode, SystemTypeDescription, ClientId]
    });
    BatchQueries.push({
        query: "update fx_total_items set counter_value = counter_value + 1 where code = ?",
        params: ["SYSTEM_TYPES"]
    });

    //Insert SystemCode
    var SystemId = "1";
    var SystemCode = "WP_DEFAULT";
    var SystemDescription = "GLOBAL";
    var strInsertSystem = "insert into systems(client_id,st_id,s_id,s_category,s_code,s_description,created_by,created_date) values(?, ?, ?, ?, ?, ?, ?, ?)";
    BatchQueries.push({
        query: strInsertSystem,
        params: [ClientId, SystemTypeId, SystemId, SystemCode, SystemCode, SystemDescription, UserId, new Date()]
    });
    BatchQueries.push({
        query: "update fx_total_items set counter_value = counter_value + 1 where code = ?",
        params: ["SYSTEMS"]
    });

    //Insert Cluster
    var ClusterId = "1";
    var ClusterCode = "WP_DEFAULT";
    var ClusterName = "GSS CLUSTER";
    var strInsertCluster = "insert into clusters(client_id,cluster_id, cluster_code, cluster_name, created_by, created_date) values(?, ?, ?, ?, ?, ?)";
    BatchQueries.push({
        query: strInsertCluster,
        params: [ClientId, ClusterId, ClusterCode, ClusterName, UserId, new Date()]
    });
    BatchQueries.push({
        query: "update fx_total_items set counter_value = counter_value + 1 where code = ?",
        params: ["CLUSTERS"]
    });

    //Insert System To System
    var Sys2SysId = "1";
    var strInsertSys2Sys = "insert into system_to_system(sts_id,cluster_code,parent_s_id,child_s_id,created_by,created_date,child_s_description) values(?, ?, ?, ?, ?, ?, ?)";
    BatchQueries.push({
        query: strInsertSys2Sys,
        params: [Sys2SysId, ClusterCode, "0", SystemId, UserId, new Date(), SystemDescription]
    });
    BatchQueries.push({
        query: "update fx_total_items set counter_value = counter_value + 1 where code = ?",
        params: ["SYS_TO_SYS"]
    });
    await reqTranDBInstance.SetSearchPathPg(cltCasSession, ['tran_db', 'clt_cas'], {});
    await ExecuteBulkQuery(ClientParams, cltCasSession, BatchQueries, "");
    console.log("CreateDefaultEntries function ended");
    return true;
}

async function CreateAppInfoEnries(ClientParams) {
    console.log("CreateAppInfoEnries function started");
    var header = ClientParams.headers;
    var ClientId = ClientParams.CLIENT_ID;
    var tenant_id = ClientParams.TENANT_ID;
    var AppId = ClientParams.APP_ID;
    var cltCasSession = ClientParams.Schema["clt_cas"];
    if (ClientParams.Schema["clt_cas"] == undefined) {
        ClientParams.Schema["clt_cas"] = cltCasSession = await getDBInstance(header, 'clt_cas');
    }
    var UserId = await GetUserID(ClientParams);
    var BatchQueries = [];

    var DeployParams = ClientParams;
    var SystemTypeId = "1";
    var SystemTypeCode = "WP_DEFAULT";
    var SystemTypeDescription = "COMPANY";
    var SystemId = "1";
    var SystemCode = "WP_DEFAULT";
    var SystemDescription = "GLOBAL";
    var ClusterId = "1";
    var ClusterCode = "WP_DEFAULT";
    var ClusterName = "GSS CLUSTER";
    var Sys2SysId = "1";
    var AppSys2SysId = "1";
    var AppUserId = "1";
    var AppUserSys2SysId = "1";
    var AppSysTypeId = "1";
    var FxTotalItemsQry = "select * from fx_total_items where code in ('APP_SYSTEM_TO_SYSTEM','APP_USER_STS','APP_USERS','APP_SYSTEM_TYPES')";
    var FxTotalItemsResult = await ExecuteDirectQuery(cltCasSession, FxTotalItemsQry);

    if (FxTotalItemsResult.rows.length > 0) {
        var FxTotalItems = {};
        FxTotalItemsResult.rows.forEach((data) => {
            FxTotalItems[data.code] = data.counter_value;
        });
        AppSys2SysId = FxTotalItems["APP_SYSTEM_TO_SYSTEM"] + 1;
        AppUserId = FxTotalItems["APP_USERS"] + 1;
        AppUserSys2SysId = FxTotalItems["APP_USER_STS"] + 1;
        AppSysTypeId = FxTotalItems["APP_SYSTEM_TYPES"] + 1;
    }

    //Insert Application    
    var ApplicationDescription = DeployParams.APPLICATION_DESCRIPTION;
    var ApplicationCode = DeployParams.APP_CODE;
    if (DeployParams.APP_ICON_DATA) {
        BatchQueries.push({
            query: "insert into applications(app_id, is_framework, client_id, app_code, app_description, created_by, created_date,application_type,app_icon_data,menu_type) values(?, ?, ?, ?, ?, ?, ?, ?, ?,?)",
            params: [DeployParams.APP_ID, "N", ClientId, DeployParams.APP_CODE, DeployParams.APPLICATION_DESCRIPTION, UserId, new Date(), DeployParams.APPLICATION_TYPE, DeployParams.APP_ICON_DATA, DeployParams.MENU_TYPE]
        });
    } else {
        BatchQueries.push({
            query: "insert into applications(app_id, is_framework, client_id, app_code, app_description, created_by, created_date,application_type) values(?, ?, ?, ?, ?, ?, ?, ?)",
            params: [DeployParams.APP_ID, "N", ClientId, DeployParams.APP_CODE, DeployParams.APPLICATION_DESCRIPTION, UserId, new Date(), DeployParams.APPLICATION_TYPE]
        });
    }

    //Insert App System To System
    var strInsertAppSys2Sys = "insert into app_system_to_system(appsts_id, app_id, cluster_code, s_category, s_code, s_description, s_id, st_id,st_code, sts_id,child_s_id,parent_s_id,created_by,created_date) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    BatchQueries.push({
        query: strInsertAppSys2Sys,
        params: [AppSys2SysId, DeployParams.APP_ID, ClusterCode, "INTERNAL", SystemCode, SystemDescription, SystemId, SystemTypeId, SystemTypeCode, Sys2SysId, SystemId, "0", UserId, new Date()]
    });
    BatchQueries.push({
        query: "update fx_total_items set counter_value = counter_value + 1 where code = ?",
        params: ["APP_SYSTEM_TO_SYSTEM"]
    });

    //Insert App users
    var strInsertAppUsers = "insert into app_users(u_id, app_id, appu_id, created_by, created_date) values(?, ?, ?, ?, ?)";
    BatchQueries.push({
        query: strInsertAppUsers,
        params: [UserId, DeployParams.APP_ID, AppUserId, UserId, new Date()]
    });
    BatchQueries.push({
        query: "update fx_total_items set counter_value = counter_value + 1 where code = ?",
        params: ["APP_USERS"]
    });

    //Insert App User Sys2Sys
    var strInsertAppUserSts = "insert into app_user_sts(appu_id, appusts_id, appsts_id, created_by, created_date) values(?, ?, ?, ?, ?)";
    BatchQueries.push({
        query: strInsertAppUserSts,
        params: [AppUserId, AppUserSys2SysId, AppSys2SysId, UserId, new Date()]
    });
    BatchQueries.push({
        query: "update fx_total_items set counter_value = counter_value + 1 where code = ?",
        params: ["APP_USER_STS"]
    });

    //Insert App System Types
    var strInsertAppSysType = "insert into app_system_types(appst_id, app_id, st_description, st_id, created_by, created_date) values(?, ?, ?, ?, ?, ?)";
    BatchQueries.push({
        query: strInsertAppSysType,
        params: [AppSysTypeId, DeployParams.APP_ID, SystemTypeDescription, SystemTypeId, UserId, new Date()]
    });
    BatchQueries.push({
        query: "update fx_total_items set counter_value = counter_value + 1 where code = ?",
        params: ["APP_SYSTEM_TYPES"]
    });

    //Insert App Roles
    var strInsertAppRoles = "insert into app_roles(app_id, appr_id, created_by, created_date, is_default, role_code, role_description, menu_type, version_no) values(?, ?, ?, ?, ?, ?, ?, ?, 0);";
    var objAppRoles = [];
    if (DeployParams.APP_ROLES) {
        DeployParams.APP_ROLES.forEach(function (role) {
            objAppRoles.push({
                "APPR_ID": role.APPR_ID,
                "ROLE_CODE": role.ROLE_CODE,
                "ROLE_DESCRIPTION": role.ROLE_DESCRIPTION,
                "MENU_TYPE": role.MENU_TYPE || "",
                "IS_DEFAULT": (role.IS_DEFAULT || "")
            });
        });
    }
    for (var iAppRole = 0; iAppRole < objAppRoles.length; iAppRole++) {
        var AppRoleInfo = objAppRoles[iAppRole];
        BatchQueries.push({
            query: strInsertAppRoles,
            params: [DeployParams.APP_ID, AppRoleInfo.APPR_ID, UserId, new Date(), AppRoleInfo.IS_DEFAULT, AppRoleInfo.ROLE_CODE, AppRoleInfo.ROLE_DESCRIPTION, AppRoleInfo.MENU_TYPE]
        });
    }

    // Insert app_systemtype_roles
    var strInsertAppSTRoles = "insert into app_systemtype_roles(app_id, system_type, created_by, created_date, appr_id, st_id) values(?, ?, ?, ?, ?, ?)";
    var arrAppSTRoles = [];
    if (DeployParams.SYSTEM_TYPE_APP_ROLES) {
        DeployParams.SYSTEM_TYPE_APP_ROLES.forEach(function (appstRole) {
            arrAppSTRoles.push({
                "APPR_ID": appstRole.APPR_ID,
                "SYSTEM_TYPE": appstRole.SYSTEM_TYPE,
                "CREATED_BY": appstRole.CREATED_BY,
                "ST_ID": appstRole.ST_ID
            });
        });
    }
    for (var iAppSTRole = 0; iAppSTRole < arrAppSTRoles.length; iAppSTRole++) {
        var AppSTRoleInfo = arrAppSTRoles[iAppSTRole];
        BatchQueries.push({
            query: strInsertAppSTRoles,
            params: [DeployParams.APP_ID, AppSTRoleInfo.SYSTEM_TYPE, AppSTRoleInfo.CREATED_BY, new Date(), AppSTRoleInfo.APPR_ID, AppSTRoleInfo.ST_ID]
        });
    }

    /* Start Prepare query for system_types  */
    var tableInfo = [{ "property_name": "SYSTEM_TYPES", "table_name": "system_types" }];
    var insertQueries = await helper.convertDBRecordsToQuery(tableInfo, DeployParams, "");
    BatchQueries = BatchQueries.concat(insertQueries);
    /* End Prepare query for system_types   */


    //AppUsrDetails
    var ClusterNodes = [{
        "clustercode": ClusterCode,
        "clustersystems": [{
            "label": SystemDescription,
            "data": {
                "s_id": SystemId,
                "CHILD_S_ID": SystemId,
                "SYS_ICON": "images/sys.png",
                "sysDesc": SystemDescription,
                "s_code": SystemCode,
                "sts_id": Sys2SysId,
                "ST_ID": SystemTypeId,
                "appsts_id": AppSys2SysId,
                "APPU_ID": AppUserId,
                "appRId": "0",
                "wft_code": "",
                "appusts_id": AppUserSys2SysId,
                "cluster_code": ClusterCode,
                "appst_id": AppSysTypeId,
                "PARENT_S_ID": "0"
            },
            "children": []
        }]
    }];

    var AppUsrStsInfo = {
        "APP_ID": DeployParams.APP_ID,
        "APP_ICON": "images/appln/app.png",
        "APP_CODE": ApplicationCode,
        "APP_DESCRIPTION": ApplicationDescription,
        "APPU_ID": AppUserId,
        "DISCLAIMER_MESSAGE": null,
        "APPU_DISCLAIMER_MESSAGE": "Y",
        "CLUSTER_NODES": JSON.stringify(ClusterNodes)
    };
    var strAllocatedDesigners = "[ { \r\n\"CODE\": \"APP_CREATION\", \r\n\"DESC\": \"Admin Management\", \r\n\"ICON\": \"\", \r\n\"CSS\": \"\", \r\n\"VIEW\": \"\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"\", \r\n\"CATEGORY_DESC\": \"\", \r\n\"MODE\": \"\" }, { \r\n\"CODE\": \"DATA_MODELLER\", \r\n\"DESC\": \"Data Modeller\", \r\n\"ICON\": \"ti-target\", \r\n\"IMG\": \"ah_datamod.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"datamodeller\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP_AR\" }, { \r\n\"CODE\": \"UI_MODELLER\", \r\n\"DESC\": \"UI Modeller\", \r\n\"ICON\": \"ti-layout-cta-btn-right\", \r\n\"IMG\": \"ah_ui.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-warning\", \r\n\"VIEW\": \"screentemplate\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP_AR\" }, { \r\n\"CODE\": \"PROCESS_ASSEMBLER\", \r\n\"DESC\": \"Process Modeller\", \r\n\"ICON\": \"ti-dribbble\", \r\n\"IMG\": \"ah_process.png\", \r\n\"ICON_TYPE\": \"ICON\", \r\n\"CSS\": \"bg-warning\", \r\n\"VIEW\": \"processassembler\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP_AR\" }, { \r\n\"CODE\": \"DESIGN_REPORT\", \r\n\"DESC\": \"Reports\", \r\n\"ICON\": \"ti-jsfiddle\", \r\n\"IMG\": \"ah_reports.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-warning\", \r\n\"VIEW\": \"Designreport\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP_AR\" }, { \r\n\"CODE\": \"EXCHANGE\", \r\n\"DESC\": \"Data Exchange\", \r\n\"ICON\": \"ti-share\", \r\n\"IMG\": \"ah_dataex.png\", \r\n\"ICON_TYPE\": \"ICON\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"exchange\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP_AR\" }, { \r\n\"CODE\": \"SCHEDULER\", \r\n\"DESC\": \"Scheduler\", \r\n\"ICON\": \"ti-timer\", \r\n\"IMG\": \"ah_scheduler.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"scheduler.viewjob\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP_AR\" }, { \r\n\"CODE\": \"COLLABORATION\", \r\n\"DESC\": \"Collaboration\", \r\n\"ICON\": \"ti-target\", \r\n\"IMG\": \"ah_collab.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"communication\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP_AR\" }, { \r\n\"CODE\": \"APPLICATION_PROJECT\", \r\n\"DESC\": \"App Project\", \r\n\"ICON\": \"ti-target\", \r\n\"IMG\": \"ah_app.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"appprojects\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP_AR\" }, { \r\n\"CODE\": \"BUILD\", \r\n\"DESC\": \"Build Manager\", \r\n\"ICON\": \"ti-write\", \r\n\"IMG\": \"ah_build.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"deploy\", \r\n\"CATEGORY\": \"AB\", \r\n\"CATEGORY_DESC\": \"APP Builder\", \r\n\"MODE\": \"APP\" }, { \r\n\"CODE\": \"MASTER\", \r\n\"DESC\": \"Client Configuration\", \r\n\"ICON\": \"ti-target\", \r\n\"IMG\": \"ah_computer.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"masters\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AS\", \r\n\"CATEGORY_DESC\": \"APP Services\", \r\n\"MODE\": \"NO\" }, { \r\n\"CODE\": \"APPLICATION_CONFIGURATION\", \r\n\"DESC\": \"App Configuration\", \r\n\"ICON\": \"ti-target\", \r\n\"IMG\": \"ah_settings.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"appcnf\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AS\", \r\n\"CATEGORY_DESC\": \"APP Services\", \r\n\"MODE\": \"APP\" }, { \r\n\"CODE\": \"BUILDER_ACCESS\", \r\n\"DESC\": \"App Builders\", \r\n\"ICON\": \"ti-target\", \r\n\"IMG\": \"ah_builder.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"platformUsers\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AS\", \r\n\"CATEGORY_DESC\": \"APP Services\", \r\n\"MODE\": \"NO\" }, { \r\n\"CODE\": \"USERS_ACCESS\", \r\n\"DESC\": \"App Users\", \r\n\"ICON\": \"ti-target\", \r\n\"IMG\": \"ah_users.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"governor\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AS\", \r\n\"CATEGORY_DESC\": \"APP Services\", \r\n\"MODE\": \"APP\" }, { \r\n\"CODE\": \"TORUS_IDE\", \r\n\"DESC\": \"Torus IDE\", \r\n\"ICON\": \"ti-layout-accordion-merged\", \r\n\"IMG\": \"ah_customcode.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"toruside\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AS\", \r\n\"CATEGORY_DESC\": \"APP Services\", \r\n\"MODE\": \"NO\" }, { \r\n\"CODE\": \"APP_STROE\", \r\n\"DESC\": \"App Store\", \r\n\"ICON\": \"ti-target\", \r\n\"IMG\": \"ah_appstore.png\", \r\n\"ICON_TYPE\": \"ICON\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"appstore\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AS\", \r\n\"CATEGORY_DESC\": \"APP Services\", \r\n\"MODE\": \"NO\" }, { \r\n\"CODE\": \"RELEASE\", \r\n\"DESC\": \"Deploy Manager\", \r\n\"ICON\": \"ti-dribbble\", \r\n\"IMG\": \"ah_deploy.png\", \r\n\"ICON_TYPE\": \"IMG\", \r\n\"CSS\": \"bg-success\", \r\n\"VIEW\": \"release\", \r\n\"ALLOCATED\": \"Y\", \r\n\"CATEGORY\": \"AS\", \r\n\"CATEGORY_DESC\": \"APP Services\", \r\n\"MODE\": \"APP\" } ]";
    //Insert user

    var strStaticModule = "[{\"CODE\":\"changepassword\",\"DESC\":\"Change Password\" }, {\"CODE\":\"usermanagement\",\"DESC\":\"User Management\" }, {\"CODE\":\"logviewer\",\"DESC\":\"Log Viewer\" }, {\"CODE\":\"tenantsetup\",\"DESC\":\"Tenant Setup\" }, {\"CODE\":\"auditlog\",\"DESC\":\"Audit Log\" }, {\"CODE\":\"exchange\",\"DESC\":\"Exchange\" }, {\"CODE\":\"comments\",\"DESC\":\"Comments\" }, {\"CODE\":\"cache\",\"DESC\":\"Data Cache\" }, {\"CODE\":\"scheduler\",\"DESC\":\"Scheduler\" }, {\"CODE\":\"LOCALIZATION\",\"DESC\":\"Localization\" }, {\"CODE\":\"wpaceeditor\",\"DESC\":\"Ace Editor\" }]";
    var ExtUserQueryObj = {
        "query": "select * from users where login_name = ? and client_id = ?",
        "params": [ClientParams.LOGIN_NAME.toString().toUpperCase(), ClientId]
    };
    var userData = await ExecuteQuery(cltCasSession, ExtUserQueryObj);
    if (userData.rows.length == 0) {
        var strInsertUser = "insert into users(login_name, client_id, u_id, allocated_designer, allocated_static_module, appur_sts, created_by, created_by_sts_id, created_date, email_id, email_password, first_name, login_password, status) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
        BatchQueries.push({
            query: strInsertUser,
            params: [ClientParams.LOGIN_NAME.toString().toUpperCase(), ClientId, UserId, strAllocatedDesigners, strStaticModule, JSON.stringify([AppUsrStsInfo]), UserId, Sys2SysId, new Date(), ClientParams.EMAIL_ID || "", ClientParams.EMAIL_PASSWORD || "", ClientParams.LOGIN_NAME, "78ABD7457D35D45A2B8384A427C2B91548250AB890F67AB777D2606967807F1C", "ACTIVE"]
        });

        BatchQueries.push({
            query: "update fx_total_items set counter_value = counter_value + 1 where code = 'USERS'",
            params: []
        });
    }
    await ExecuteBulkQuery(ClientParams, cltCasSession, BatchQueries, "");
    console.log("CreateAppInfoEnries function ended");
    return true;
}

async function ExecuteFileQuery(ClientParams, filepath, filename) {
    console.log("ExecuteFileQuery function started : " + filename);
    var strQryPath = Path.join(filepath, filename);
    if (FileSystem.existsSync(strQryPath)) {
        var fileArr = filename.split(".");
        var fileName = fileArr[0];
        var ext = fileArr[1];

        var keyspace = "";
        var pSession = undefined;
        if (filename == "ddl.sql" || filename == "dml.sql" || filename == "masterdata.sql") {
            var keyspace = "public";
            pSession = ClientParams.Schema[keyspace];
            if (ClientParams.Schema[keyspace] == undefined) ClientParams.Schema[keyspace] = pSession = await getDBInstance(ClientParams.headers, keyspace);
        } else if (fileName == "language_dictionary_json") {
            var keyspace = "clt_cas";
            pSession = ClientParams.Schema[keyspace];
            if (ClientParams.Schema[keyspace] == undefined) ClientParams.Schema[keyspace] = pSession = await getDBInstance(ClientParams.headers, keyspace);
        } else if (fileName == "dml_scripts") {
            var keyspace = "dep_cas";
            pSession = ClientParams.Schema[keyspace];
            if (ClientParams.Schema[keyspace] == undefined) ClientParams.Schema[keyspace] = pSession = await getDBInstance(ClientParams.headers, keyspace);
        } else if (fileName == "ddl_scripts" || fileName == "language_dictionary_source") {
            var keyspace = "ad_gss_tran";
            pSession = ClientParams.Schema[keyspace];
            if (ClientParams.Schema[keyspace] == undefined) ClientParams.Schema[keyspace] = pSession = await getTranDBInstance(ClientParams.headers, keyspace);
        }

        if (ext == "json") {
            var strQueryJson = FileSystem.readFileSync(strQryPath).toString();
            var objQueryJson = [];
            if (strQueryJson != "") {
                if (fileName == "language_dictionary_source" || fileName == "language_dictionary_json") {
                    objQueryJson = helper.ParseJson(strQueryJson);
                } else {
                    objQueryJson = helper.ParseQryJson(strQueryJson);
                }
            }
            if (objQueryJson == null) {
                throw new Error(strQryPath + " :: Json parse error");
            }
            if (objQueryJson.length > 0) {

                if (fileName == "language_dictionary_source" || fileName == "language_dictionary_json") {
                    var BatchQueries = [];
                    BatchQueries.push({
                        "query": "delete from " + fileName + " where client_id=?",
                        "params": [objQueryJson[0].CLIENT_ID]
                    });
                    /* Start Prepare query object  */
                    var tableInfo = [{ "property_name": fileName.toUpperCase(), "table_name": fileName.toLowerCase() }];
                    if (fileName == "language_dictionary_json") {
                        tableInfo[0]["keyword"] = "group";
                    }
                    var DeployParams = {};
                    DeployParams[fileName.toUpperCase()] = objQueryJson;
                    var insertQueries = await helper.convertDBRecordsToQuery(tableInfo, DeployParams, "");
                    BatchQueries = BatchQueries.concat(insertQueries);
                    /* End Prepare query object   */
                    await ExecuteBulkQuery(ClientParams, pSession, BatchQueries, fileName);
                } else {
                    /*******truncate tables******* */
                    if (ClientParams.FunctionName == "DoRelease" && fileName == "dml_scripts" && ClientParams.CLEANUP_TABLES == true) {
                        console.log("truncate table query execute started");
                        await CleanupTables(ClientParams);
                        console.log("truncate table query executed");
                    }
                    for (var iqry = 0; iqry < objQueryJson.length; iqry++) {
                        var data = objQueryJson[iqry];
                        var QryObj = {};
                        if (data.content) {
                            data.content = data.content.split("$DQ$").join('"');
                            data.content = data.content.split("$SQ$").join("'");
                            data.content = data.content.split("$SL$").join("\\");
                            if (fileName == "ddl_scripts") {
                                data.content = data.content.split("''").join("'");
                            }
                            QryObj = JSON.parse(data.content);
                        } else {
                            data.query = data.query.split("''").join("'");
                            QryObj = data;
                        }
                        var result = await ExecuteQuery(pSession, QryObj);
                        if (ClientParams.FailedQueries[fileName] == undefined) {
                            ClientParams.FailedQueries[fileName] = [];
                        }
                        if (result.qry_status == "ERROR") {
                            ClientParams.FailedQueries[fileName].push(result);
                        }
                    }
                }
            }

        } else if (ext == "sql") {
            var strQueryJson = FileSystem.readFileSync(strQryPath).toString();
            var BatchQueries = [];
            var splittedQuery = strQueryJson.split("@SPL@");
            for (var iqry = 0; iqry < splittedQuery.length; iqry++) {
                //splittedQuery[iqry] = helper.StringReplaceAll(splittedQuery[iqry], "\n", " ");
                if (splittedQuery[iqry].toString() == "" || splittedQuery[iqry].toString() == " ") {
                    continue;
                }
                var qry = helper.QueryTrim(splittedQuery[iqry]);
                var query = { "query": qry, "params": [] };
                var DBName = ClientParams.DB_NAME;
                query.query = helper.StringReplaceAll(query.query.toString(), "<database>", DBName);
                if (query.query.indexOf("CREATE DATABASE") == -1) {
                    var result = await ExecuteDirectQuery(pSession, query.query);
                    if (ClientParams.FailedQueries[fileName] == undefined) {
                        ClientParams.FailedQueries[fileName] = [];
                    }
                    if (result.qry_status == "ERROR") {
                        ClientParams.FailedQueries[fileName].push(result);
                    }
                }
            }
        }
        console.log("ExecuteFileQuery function ended : " + filename);
        return true;
    }
}

async function UpdateAppRoles(ClientParams) {
    console.log("ReleaseUpdate function started");
    var CurrentDateTime = ClientParams.CurrentDateTime;
    console.log(CurrentDateTime);
    var pSession = await getDBInstance(ClientParams.headers, "clt_cas");
    var depSession = await getDBInstance(ClientParams.headers, "dep_cas");
    var DeployParams = ClientParams;
    var CurrentDateTime = new Date();
    var ClientId = ClientParams.CLIENT_ID;
    var EnvCode = ClientParams.ENV_CODE;
    var AppId = ClientParams.APP_ID;
    var TenantId = ClientParams.TENANT_ID;
    var BuildId = ClientParams.BUILD_ID;
    var LoginName = ClientParams.LOGIN_NAME;

    var DeployDetailQry = {
        "query": "insert into deployment_details(client_id, env_code, app_id, created_by, created_date, deploy_id, modified_by, modified_date, status, tenant_id) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        "params": [ClientId, EnvCode.toUpperCase(), AppId, LoginName, CurrentDateTime, BuildId, LoginName, CurrentDateTime, "RUNNING", TenantId]
    };
    ExecuteQuery(depSession, DeployDetailQry);

    var BatchQueries = [];
    var objAppRoles = [];
    if (DeployParams.APP_ROLES) {
        DeployParams.APP_ROLES.forEach(function (role) {
            objAppRoles.push({
                "APPR_ID": role.APPR_ID,
                "ROLE_CODE": role.ROLE_CODE,
                "ROLE_DESCRIPTION": role.ROLE_DESCRIPTION,
                "IS_DEFAULT": (role.IS_DEFAULT || ""),
                "MENU_TYPE": role.MENU_TYPE || ""
            });
        });
    }

    if (objAppRoles.length) {
        BatchQueries.push({
            query: "delete from app_roles where appr_id not in ('0') and app_id=?",
            params: [DeployParams.APP_ID]
        });
    }

    var CurrentDateTime = reqDateFormatter.GetCurrentDate(ClientParams.headers);
    for (var iAppRole = 0; iAppRole < objAppRoles.length; iAppRole++) {
        var AppRoleInfo = objAppRoles[iAppRole];
        BatchQueries.push({
            query: "insert into app_roles(app_id, appr_id, created_by, created_date, is_default, role_code, role_description, menu_type, version_no) values(?, ?, ?, ?, ?, ?, ?, ?, ?);",
            params: [DeployParams.APP_ID, AppRoleInfo.APPR_ID, DeployParams.U_ID, CurrentDateTime, AppRoleInfo.IS_DEFAULT, AppRoleInfo.ROLE_CODE, AppRoleInfo.ROLE_DESCRIPTION, AppRoleInfo.MENU_TYPE, 0]
        });
    }
    // Insert app_systemtype_roles
    var strInsertAppSTRoles = "insert into app_systemtype_roles(app_id, system_type, created_by, created_date, appr_id, st_id) values(?, ?, ?, ?, ?, ?)";
    var arrAppSTRoles = [];
    if (DeployParams.SYSTEM_TYPE_APP_ROLES) {
        DeployParams.SYSTEM_TYPE_APP_ROLES.forEach(function (appstRole) {
            arrAppSTRoles.push({
                "APPR_ID": appstRole.APPR_ID,
                "SYSTEM_TYPE": appstRole.SYSTEM_TYPE,
                "CREATED_BY": appstRole.CREATED_BY,
                "ST_ID": appstRole.ST_ID
            });
        });
    }
    if (arrAppSTRoles.length) {
        BatchQueries.push({
            query: "delete from app_systemtype_roles where app_id=?",
            params: [DeployParams.APP_ID]
        });
    }
    for (var iAppSTRole = 0; iAppSTRole < arrAppSTRoles.length; iAppSTRole++) {
        var AppSTRoleInfo = arrAppSTRoles[iAppSTRole];
        BatchQueries.push({
            query: strInsertAppSTRoles,
            params: [DeployParams.APP_ID, AppSTRoleInfo.SYSTEM_TYPE, AppSTRoleInfo.CREATED_BY, CurrentDateTime, AppSTRoleInfo.APPR_ID, AppSTRoleInfo.ST_ID]
        });
    }

    if (DeployParams.SYSTEM_TYPES && DeployParams.SYSTEM_TYPES.length) {
        /* Start Prepare query for system_types insert  */
        var arrStData = DeployParams.SYSTEM_TYPES;
        for (var istdata = 0; istdata < arrStData.length; istdata++) {
            var objdelqry = {
                query: 'delete from system_types where client_id=? and st_id=? and st_code=?',
                params: [arrStData[istdata].CLIENT_ID, arrStData[istdata].ST_ID, arrStData[istdata].ST_CODE]
            };
            BatchQueries.push(objdelqry);
        }
        /* Start Prepare query for system_types insert  */
        var tableInfo = [{ "property_name": "SYSTEM_TYPES", "table_name": "system_types" }];
        var insertQueries = await helper.convertDBRecordsToQuery(tableInfo, DeployParams, "");
        if (insertQueries.length) {
            BatchQueries = BatchQueries.concat(insertQueries);
        }
        /* End Prepare query for system_types   */
    }

    await ExecuteBulkQuery(ClientParams, pSession, BatchQueries, "");

    console.log("ReleaseUpdate function ended");
    return true;
}

async function ExecuteIDEProjects(ClientParams, filePath, projectType) {
    console.log("ExecuteIDEProjects function started");
    var ProjectTypePath = Path.join(filePath, projectType);
    ClientParams.Schema["ad_gss_tran"] = pSession = await getTranDBInstance(ClientParams.headers);
    if (FileSystem.existsSync(ProjectTypePath)) {
        var BatchQueries = [];
        var ProjectDirectories = await helper.GetDirectories(ProjectTypePath);
        for (var pf = 0; pf < ProjectDirectories.length; pf++) {
            if (projectType == "sql_project") {
                var strFolder = Path.join(ProjectTypePath, ProjectDirectories[pf]);
                var strFiles = "";
                if (FileSystem.existsSync(strFolder)) {
                    strFiles = FileSystem.readdirSync(strFolder).toString();
                }
                var Files = strFiles.split(".sql");
                for (var file_idx = 0; file_idx < Files.length; file_idx++) {
                    if (Files[file_idx].toString() == "" || Files[file_idx].toString() == " ") {
                        continue;
                    }
                    if (Files[file_idx].charAt(0) == ',') {
                        Files[file_idx] = Files[file_idx].substring(1, Files[file_idx].length);
                    }
                    var strFileJson = Path.join(strFolder, Files[file_idx] + ".sql");
                    var strQuery = "";
                    if (FileSystem.existsSync(strFileJson)) {
                        strQuery = FileSystem.readFileSync(strFileJson).toString();
                    }
                    var splittedQuery = strQuery.split("@SPL@");
                    for (var iqry = 0; iqry < splittedQuery.length; iqry++) {
                        //splittedQuery[iqry] = helper.StringReplaceAll(splittedQuery[iqry], "\n", " ");
                        if (splittedQuery[iqry].toString() == "" || splittedQuery[iqry].toString() == " ") {
                            continue;
                        }
                        var qryObj = { "query": splittedQuery[iqry].toString(), "params": [] };
                        //BatchQueries.push(qryObj);
                        var result = await ExecuteDirectQuery(pSession, qryObj.query);
                        if (ClientParams.FailedQueries["sql_project"] == undefined) {
                            ClientParams.FailedQueries["sql_project"] = [];
                        }
                        if (result.qry_status == "ERROR") {
                            ClientParams.FailedQueries["sql_project"].push(result);
                        }
                    }
                }
            }
        }
        //await ExecuteBulkQuery(ClientParams, pSession, BatchQueries, projectType);
    }
    console.log("ExecuteIDEProjects function ended");
}

async function HandleFailedQueries(ClientParams) {
    console.log("HandleFailedQueries function called");
    var BatchQueries = [];
    var FailedQueryCount = 1;
    var CurrentDateTime = new Date();
    var ClientId = ClientParams.CLIENT_ID;
    var EnvCode = ClientParams.ENV_CODE;
    var AppId = ClientParams.APP_ID;
    var TenantId = ClientParams.TENANT_ID;
    var BuildId = ClientParams.BUILD_ID;
    var LoginName = ClientParams.LOGIN_NAME;
    BatchQueries.push({
        "query": "truncate table deployment_script_items",
        "params": []
    });
    var strInsertFailedQry = "insert into deployment_script_items(dsi_id, client_id, env_code, deploy_id, created_by, created_date, modified_by, modified_date, query, query_type, status) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    for (var category in ClientParams.FailedQueries) {
        if (ClientParams.FailedQueries[category].length > 0) {

            var LogDir = Path.join(__dirname, "../../", "log");
            var fileName = `log_clt${ClientId}_env${EnvCode}_app${AppId}_tnt${TenantId}_rel${BuildId}.log`;
            if (FileSystem.existsSync(LogDir) == false) {
                FileSystem.mkdirSync(LogDir);
            }
            var LogFile = Path.join(LogDir, fileName);
            if (FileSystem.existsSync(LogFile) == false) {
                FileSystem.writeFileSync(LogFile, "");
            }
            FileSystem.appendFileSync(LogFile, "\n====================" + category + "======================\n");
            FileSystem.appendFileSync(LogFile, "\n");
            FileSystem.appendFileSync(LogFile, JSON.stringify(ClientParams.FailedQueries[category]));
            FileSystem.appendFileSync(LogFile, "\n");

            var QueryType = category;
            if (category == "dml_scripts") {
                QueryType = "dml";
            } else if (category == "ddl_scripts") {
                QueryType = "ddl";
            }

            if (category == "solr") {
                var FailedQueries = ClientParams.FailedQueries[category];
                var newQueryInfo = {
                    "query": strInsertFailedQry,
                    "params": [FailedQueryCount, ClientId, EnvCode.toUpperCase(), BuildId, LoginName, CurrentDateTime, LoginName, CurrentDateTime, JSON.stringify(FailedQueries), "Solr", "ERROR"]
                };
                BatchQueries.push(newQueryInfo);
                FailedQueryCount++;
            } else {
                var FailedQueries = ClientParams.FailedQueries[category];
                FailedQueries.forEach(function (query) {
                    var newQueryInfo = {
                        "query": strInsertFailedQry,
                        "params": [FailedQueryCount, ClientId, EnvCode.toUpperCase(), BuildId, LoginName, CurrentDateTime, LoginName, CurrentDateTime, JSON.stringify(query), QueryType, "ERROR"]
                    };
                    BatchQueries.push(newQueryInfo);
                    FailedQueryCount++;
                });
            }
        }
    }
    var DeployedStatus = (BatchQueries.length > 1) ? "SUCCESS_WITH_ERRORS" : "SUCCESS";
    ClientParams.DeployedStatus = DeployedStatus;
    BatchQueries.push({
        "query": "delete from deployment_details where client_id = ? and env_code = ? and app_id = ? and tenant_id = ? ",
        "params": [ClientId, EnvCode.toUpperCase(), AppId, TenantId]
    });
    BatchQueries.push({
        "query": "insert into deployment_details(client_id, env_code, app_id, created_by, created_date, deploy_id, modified_by, modified_date, status, tenant_id) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        "params": [ClientId, EnvCode.toUpperCase(), AppId, LoginName, CurrentDateTime, BuildId, LoginName, CurrentDateTime, DeployedStatus, TenantId]
    });
    var pSession = undefined;
    if (ClientParams.Schema["dep_cas"] == undefined) {
        ClientParams.Schema["dep_cas"] = pSession = await getDBInstance(ClientParams.headers, "dep_cas");
    }
    pSession = ClientParams.Schema["dep_cas"];
    await ExecuteBulkQuery(ClientParams, pSession, BatchQueries, "");
    console.log("HandleFailedQueries function ended");
    return DeployedStatus;
    // if(DeployedStatus=="SUCCESS_WITH_ERRORS") {
    //     throw new Error("please verify log folder for failed queries")
    // }
}

async function CleanupTables(ClientParams) {
    console.log("CleanupTables function called");
    var pSession = undefined;
    if (ClientParams.Schema["dep_cas"] == undefined) {
        ClientParams.Schema["dep_cas"] = pSession = await getDBInstance(ClientParams.headers, "dep_cas");
    }
    pSession = ClientParams.Schema["dep_cas"];
    var strCnfPath = __dirname + "/truncatetables.json";
    if (FileSystem.existsSync(strCnfPath)) {
        strChangeInfo = FileSystem.readFileSync(strCnfPath).toString();
        if (strChangeInfo != "") {
            var TruncateTable = JSON.parse(strChangeInfo);
            for (var t = 0; t < TruncateTable.length; t++) {
                var query = `delete from  dep_tran.${TruncateTable[t]} where app_id = '${ClientParams.APP_ID}'`;
                if (TruncateTable[t].toLowerCase() == "comm_info") {
                    query = query + " and COALESCE (creation_mode, ' ')  <> 'RUN_TIME'"
                }
                var result = await ExecuteDirectQuery(pSession, query);
                if (ClientParams.FailedQueries["truncate_query"] == undefined) {
                    ClientParams.FailedQueries["truncate_query"] = [];
                }
                if (result.qry_status == "ERROR") {
                    ClientParams.FailedQueries["truncate_query"].push(result);
                }
            }
        }
    }
    console.log("CleanupTables function ended");
}

function GetUserID(ClientParams) {
    console.log("GetUserID function called");
    return new Promise((resolve, reject) => {
        try {
            var ClientId = ClientParams.CLIENT_ID;
            var pSession = ClientParams.Schema["clt_cas"];
            var ExtUserQueryObj = {
                "query": "select * from users where login_name = ? and client_id = ?",
                "params": [ClientParams.LOGIN_NAME.toString().toUpperCase(), ClientId]
            };

            ExecuteQuery(pSession, ExtUserQueryObj).then((resExtUser) => {
                if (resExtUser.qry_status == "SUCCESS") {
                    if (resExtUser.rowCount > 0) {
                        UserInfo = resExtUser.rows[0];
                        UserId = UserInfo.u_id;
                        resolve(UserId);
                        console.log("GetUserID function ended");
                    }
                    else {
                        var FxItemObj = {
                            "query": "select counter_value from fx_total_items where code = ?",
                            "params": ["USERS"]
                        };
                        ExecuteQuery(pSession, FxItemObj).then((FxItems) => {
                            if (FxItems.qry_status == "SUCCESS") {
                                if (FxItems.rowCount > 0 && FxItems.rows[0].counter_value) {
                                    UserId = FxItems.rows[0].counter_value.toString();
                                    console.log("GetUserID function ended");
                                    resolve(UserId);
                                }
                            }
                        });

                    }
                }
            }).catch((err) => {
                console.log("GetUserID function ended");
                reject(err);
            });

        } catch (err) {
            console.log("GetUserID function ended");
            reject(err);
        }
    });
}

async function ExecuteQuery(pSession, QueryObj) {
    console.log("ExecuteQuery function started");
    return new Promise((resolve, reject) => {
        var objLogInfo = {};
        reqTranDBInstance.ExecuteSQLQueryWithParams(pSession, QueryObj, objLogInfo, (result, err) => {
            if (!err) {
                result.qry_status = "SUCCESS";
                console.log("ExecuteQuery function ended");
                resolve(result);
            } else {
                QueryObj.qry_status = "ERROR";
                QueryObj.err_msg = err.toString();
                console.log("ExecuteQuery function ended");
                resolve(QueryObj);
            }
        });
    });
}

async function ExecuteBulkQuery(ClientParams, pSession, BatchQueries, category) {
    console.log("ExecuteBulkQuery function called");
    try {
        for (var iQry = 0; iQry < BatchQueries.length; iQry++) {
            var result = await ExecuteQuery(pSession, BatchQueries[iQry]);
            if (ClientParams.FailedQueries[category] == undefined) {
                ClientParams.FailedQueries[category] = [];
            }
            if (result.qry_status == "ERROR") {
                ClientParams.FailedQueries[category].push(result);
            }
        }
        console.log("ExecuteBulkQuery function ended");
        return true;
    } catch (err) {
        console.log("ExecuteBulkQuery function ended");
        return err.toString();
    }
}

function ExecuteDirectQuery(pSession, Query) {
    console.log("ExecuteDirectQuery function called");
    return new Promise((resolve, reject) => {
        reqTranDBInstance.ExecuteSQLQuery(pSession, Query, {}, (result, err) => {
            if (!err) {
                result.qry_status = "SUCCESS";
                console.log("ExecuteDirectQuery function ended");
                resolve(result);
            } else {
                var result = {};
                result.query = Query;
                result.qry_status = "ERROR";
                result.err_msg = err.toString();
                console.log("ExecuteDirectQuery function ended");
                resolve(result);
            }
        });
    });
}

async function GetDeployScriptItems(ClientParams) {
    console.log("GetDeployScriptItems function called");
    var pSession = undefined;
    var DeployScriptItem = [];
    if (ClientParams.Schema["dep_cas"] == undefined) {
        ClientParams.Schema["dep_cas"] = pSession = await getDBInstance(ClientParams.headers, "dep_cas");
    }
    pSession = ClientParams.Schema["dep_cas"];
    var QueryObj = {
        "query": "select * from deployment_script_items ",
        "params": []
    };
    var scriptItemResult = await ExecuteQuery(pSession, QueryObj);
    if (scriptItemResult.qry_status == "SUCCESS") {
        if (scriptItemResult.rows.length > 0) {
            scriptItemResult.rows.forEach((data) => {
                var scriptObj = {};
                var QueryObj = JSON.parse(data.query);
                var qryobj = {
                    "query": QueryObj.query,
                    "params": QueryObj.params || []
                };
                scriptObj.dsi_id = data.dsi_id;
                scriptObj.query_type = data.query_type;
                scriptObj.query_text = JSON.stringify(qryobj);
                scriptObj.status = data.status;
                scriptObj.exception = QueryObj.err_msg;
                DeployScriptItem.push(scriptObj);
            });
        }
    }
    console.log("GetDeployScriptItems function ended");
    return DeployScriptItem;
}

async function GetDeployDetails(ClientParams) {
    console.log("GetDeployDetails function called");
    var pSession = undefined;
    var pReturnVal = {
        "FirstTime": "Y",
        "DeployInfo": {}
    };
    pSession = await getDBInstance(ClientParams.headers, 'dep_cas');
    var QueryObj = {
        "query": "select * from deployment_details ",
        "params": []
    };
    var DeployDetailResult = await ExecuteQuery(pSession, QueryObj);
    if (DeployDetailResult.qry_status == "ERROR" && DeployDetailResult.err_msg.indexOf('relation "deployment_details" does not exist') > -1) {
        pReturnVal.FirstTime = "Y";
    } else if (DeployDetailResult.qry_status == "SUCCESS") {
        if (DeployDetailResult.rows.length == 0) {
            pReturnVal.FirstTime = "Y";
        } else {
            pReturnVal.FirstTime = "N";
            pReturnVal.DeployInfo = DeployDetailResult.rows[0];
        }
    }
    console.log("GetDeployDetails function ended");
    return pReturnVal;
}

async function QueryAction(ClientParams, QueryDetail, Action) {
    console.log("QueryAction function called");
    var pSession = undefined;
    if (!ClientParams.Schema) {
        ClientParams.Schema = {};
    }
    if (ClientParams.Schema["dep_cas"] == undefined) {
        ClientParams.Schema["dep_cas"] = pSession = await getDBInstance(ClientParams.headers, "dep_cas");
    }
    var depSession = ClientParams.Schema["dep_cas"];
    ClientParams.Schema["ad_gss_tran"] = await getTranDBInstance(ClientParams.headers, "ad_gss_tran");

    pSession = ClientParams.Schema["dep_cas"];
    var failedquery = false;
    if (Action == "DELETE") {
        var dsi_id = QueryDetail.EXECUTE_ID;
        var QueryObj = {
            "query": "delete from dep_tran.deployment_script_items where dsi_id='" + dsi_id + "'",
            "params": []
        };
        await ExecuteQuery(pSession, QueryObj);
    }
    else if (Action == "UPDATE") {

        var id = QueryDetail.EXECUTE_ID;
        var UpdateObj = QueryDetail.UPDATE_COLUMN;
        var QueryObj = {
            "query": `update dep_tran.deployment_script_items set query='${UpdateObj}' where dsi_id='${id}'`,
            "params": []
        };
        var scriptItemResult = await ExecuteDirectQuery(pSession, QueryObj.query);
        if (scriptItemResult.qry_status == "ERROR") {
            failedquery = true;

        }
        return failedquery;
    }
    else if (Action == "RETRY") {
        var ids = QueryDetail.EXECUTE_IDS.join("','");
        var QueryObj = {
            "query": "SELECT * FROM deployment_script_items where dsi_id in ('" + ids + "') ",
            "params": []
        };
        var scriptItemResult = await ExecuteQuery(pSession, QueryObj);
        if (scriptItemResult.qry_status == "SUCCESS") {
            if (scriptItemResult.rows.length > 0) {
                //scriptItemResult.rows.forEach(function (data) {
                for (var r = 0; r < scriptItemResult.rows.length; r++) {
                    var data = scriptItemResult.rows[r];
                    var RetryQueryObj = JSON.parse(data.query);
                    if (data.query_type == "ddl") {
                        pSession = ClientParams.Schema["ad_gss_tran"];
                    }
                    var RetryResult = await ExecuteQuery(pSession, RetryQueryObj);
                    if (RetryResult.qry_status == "SUCCESS") {
                        var QueryObj = {
                            "query": "delete from dep_tran.deployment_script_items where dsi_id='" + data.dsi_id + "'",
                            "params": []
                        };
                        await ExecuteQuery(depSession, QueryObj);
                    } else {
                        failedquery = true;
                        var UpdateColumn = JSON.stringify(RetryResult);
                        var QueryObj = {
                            "query": `update dep_tran.deployment_script_items set query='${UpdateColumn}' where dsi_id='${data.dsi_id}'`,
                            "params": []
                        };
                        await ExecuteDirectQuery(depSession, QueryObj.query);
                    }
                };
            }
        }
        console.log("QueryAction function ended");
        return failedquery;
    }


}

async function Signin(ClientParams) {
    console.log("Signin function called");
    var loginobj = {};
    var pSession = await getDBInstance(ClientParams.headers, "clt_cas");
    var ExtUserQueryObj = {
        "query": "select * from users where login_name = ? and client_id = ?",
        "params": [ClientParams.username.toUpperCase(), ClientParams.CLIENT_ID]
    };
    var userData = await ExecuteQuery(pSession, ExtUserQueryObj);
    if (userData.rows.length > 0) {
        loginobj = helper.CheckUsernamePassword(ClientParams.username, ClientParams.password, userData.rows[0].login_name, userData.rows[0].login_password, ClientParams["salt-session"]);
    } else {
        loginobj.STATUS = "ERROR";
        loginobj.PROCESS_STATUS = "User does not exist.";
        loginobj.isAuthenticated = false;
    }
    console.log("Signin function ended");
    return loginobj;
}

async function CheckDeployDetailStatus(ClientParams) {
    console.log("CheckDeployDetailStatus function called");
    var CurrentDateTime = new Date();
    var ClientId = ClientParams.CLIENT_ID;
    var EnvCode = ClientParams.ENV_CODE;
    var AppId = ClientParams.APP_ID;
    var TenantId = ClientParams.TENANT_ID;
    var BuildId = ClientParams.BUILD_ID;
    var LoginName = ClientParams.LOGIN_NAME;
    var pSession = await getDBInstance(ClientParams.headers, "dep_cas");
    var QueryObj = {
        "query": "select status from deployment_details where client_id = ? and env_code = ? and app_id = ? and tenant_id = ? and deploy_id = ?",
        "params": [ClientId, EnvCode.toUpperCase(), AppId, TenantId, BuildId]
    };
    var Data = await ExecuteQuery(pSession, QueryObj);
    if (Data.rows.length > 0) {
        if (Data.rows[0].status == "RUNNING") {
            console.log("CheckDeployDetailStatus function ended");
            throw new Error("Already release script running. Please wait...");
        }
    }
    console.log("CheckDeployDetailStatus function ended");
    //already previous release have failed queries. please check.
}

async function CheckApplication(ClientParams) {
    console.log("CheckApplication function called");
    var ClientId = ClientParams.CLIENT_ID;
    var AppId = ClientParams.APP_ID;
    var pSession = await getDBInstance(ClientParams.headers, "clt_cas");
    var QueryObj = {
        "query": "select app_id from applications where app_id = ? and is_framework = ? and client_id = ?",
        "params": [AppId, "N", ClientId]
    };
    var Data = await ExecuteQuery(pSession, QueryObj);
    console.log("CheckApplication function ended");
    return Data.rows.length;
}

module.exports = {
    CreateSchema: CreateSchema,
    CreateDefaultEntries: CreateDefaultEntries,
    CreateAppInfoEnries: CreateAppInfoEnries,
    ExecuteFileQuery: ExecuteFileQuery,
    UpdateAppRoles: UpdateAppRoles,
    ExecuteIDEProjects: ExecuteIDEProjects,
    HandleFailedQueries: HandleFailedQueries,
    CleanupTables: CleanupTables,
    GetDeployScriptItems: GetDeployScriptItems,
    GetDeployDetails: GetDeployDetails,
    QueryAction: QueryAction,
    Signin: Signin,
    CheckDeployDetailStatus: CheckDeployDetailStatus,
    CheckApplication: CheckApplication
};