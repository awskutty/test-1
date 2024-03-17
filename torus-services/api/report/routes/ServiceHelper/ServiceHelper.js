/**
 *Decsription      : To maintain common functions definition for report 
 *Last Error Code  : ERR-RPT-60724
 **/

//Custom functions
var StringFormat = function() {
    if (!arguments.length)
        return "";
    var str = arguments[0] || "";
    str = str.toString();
    var args = typeof arguments[0],
        args = (("string" == args) ? arguments : arguments[0]);
    [].splice.call(args, 0, 1);
    for (var arg in args)
        str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
    str = str.replace(RegExp("\\{\\{", "gi"), "{");
    str = str.replace(RegExp("\\}\\}", "gi"), "}");
    return str;
};

function StringBuilder() {
    var strings = [];
    //  this.sbstring = [];
    this.append = function(string) {
        string = verify(string);
        if (string.length > 0) strings[strings.length] = string;
    };

    this.appendLine = function(string) {
        string = verify(string);
        if (this.isEmpty()) {
            if (string.length > 0) strings[strings.length] = string;
            else return;
        } else strings[strings.length] = string.length > 0 ? "\r\n" + string : "\r\n";
    };

    this.clear = function() {
        strings = [];
        //sbstring = [];
    };

    this.length = function() {

        return strings.length;
    }

    this.isEmpty = function() {
        return strings.length == 0;
    };

    this.toString = function() {
        return strings.join("");
    };

    var verify = function(string) {
        if (!defined(string)) return "";
        if (getType(string) != getType(new String())) return String(string);
        return string;
    };

    var defined = function(el) {

        return el != null && typeof(el) != "undefined";
    };

    var getType = function(instance) {
        if (!defined(instance.constructor)) throw Error("Unexpected object type");
        var type = String(instance.constructor).match(/function\s+(\w+)/);

        return defined(type) ? type[1] : "undefined";
    };

}

module.exports = {
    StringBuilder: new StringBuilder,
    StringFormat: StringFormat
}