$(document).ready(function(){
	$("#progress").hide();
    $("#open").click(function(e){
        console.log('open');
        e.preventDefault();
        $.ajax({type: "POST",
                url: "/openOrCloseGarage",
                data: { garageSwitch:'open' },
                success:function(result){
				$("#status").html(result);
        }});
    });
    $("#close").click(function(e){
        e.preventDefault();
        $.ajax({type: "POST",
                url: "/openOrCloseGarage",
                data: { garageSwitch:'close' },
                success:function(result){
	            $("#status").html(result);
        }});
    });
});
