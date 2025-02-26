var BasePage = require('..//pages//BasePage.js');
var Lifetimemembershippage = require('..//pages//Lifetimemembershippage.js');
var obj =require('../Object2.json');

describe("lifetimememebership login page",function(){

    it("lifetimemembership login test page", function(){

        
        BasePage.navigateToURL("https://www.way2automation.com/angularjs-protractor/banking/#/login");
      browser.sleep(1000);
        
        var title =  BasePage.getPageTitle().then (function(text){
            console.log(text);
           });
           Lifetimemembershippage.gotolifetimemembershippage();
           Lifetimemembershippage.gotolinkdinpage();
    });
});