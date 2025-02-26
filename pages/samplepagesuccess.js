const { on } = require('events');
var obj =require('../Object.json');
var customlocator = require('../util/customlocator.js');
var SelectWrapper = require('../util/select-wrapper.js');
var mySelect = new SelectWrapper(by.id("gender"));


var samplepagesuccess = function() {


    this.SampleForm = function(){
         browser.sleep(3000);
       
         element(by.partialLinkText("Sample")).click();

    };

    this.SampleForminfo = function(firstname,lastname,email,password,abouttext,expectedText){
       
        element(by.xpath(obj.locators.sampleformpage.firstName)).sendKeys(firstname);
        
         element(by.xpath(obj.locators.sampleformpage.lastName)).sendKeys(lastname);
         element(by.xpath(obj.locators.sampleformpage.Email)).sendKeys(email);
         element(by.xpath(obj.locators.sampleformpage.password)).sendKeys(password);
         element(by.xpath(obj.locators.sampleformpage.Readingckbox)).click();
        mySelect.selectByValue("male");
       browser.sleep(2000);
        element(by.xpath(obj.locators.sampleformpage.About)).sendKeys(abouttext);
        browser.sleep(2000);
        element(by.xpath(obj.locators.sampleformpage.register)).click();
        browser.sleep(2000);
        element(by.xpath(obj.locators.sampleformpage.successmasessage)).getText().then(function(text){
 
            console.log(text);
                   
           });
           
           expect(element(by.xpath(obj.locators.sampleformpage.successmasessage)).getText()).toEqual(expectedText);
         }
        

    };
   

module.exports = new samplepagesuccess();