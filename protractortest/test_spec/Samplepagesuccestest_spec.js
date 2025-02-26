var BasePage = require('..//pages//BasePage.js');
var HomePage = require('..//pages//samplepagesuccess.js');
var obj =require('../Object.json');


describe("SampleForm login test",function(){
  
    it("login as SampleForm",function(){

      
        BasePage.navigateToURL("https://www.way2automation.com/angularjs-protractor/banking/#/login");
     
        var title =  BasePage.getPageTitle().then (function(text){
            console.log(text);
           });
     
        HomePage.SampleForm();
        HomePage.SampleForminfo(obj.locators.sampleformpage.testdata.fName,obj.locators.sampleformpage.testdata.lName,obj.locators.sampleformpage.testdata.Email,
        obj.locators.sampleformpage.testdata.Password,obj.locators.sampleformpage.testdata.abouttext,
        obj.locators.sampleformpage.testdata.expectedText );
        
        
        browser.sleep(1000);

    
    });
    
 
    });
 
