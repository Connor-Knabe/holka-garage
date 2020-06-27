$(document).ready(function() {
	$('#progress').hide();
	$('#stream').hide();
	$('#open').click(function(e) {
		e.preventDefault();
		$('#open').attr('disabled', 'disabled');
		$.ajax({
			type: 'POST',
			url: '/openOrCloseGarage',
			data: { garageSwitch: 'open' },
			success: function(result) {
				$('#status').html(result);
			}
		});
	});
	$('#close').click(function(e) {
		e.preventDefault();
		$('#close').attr('disabled', 'disabled');
		$.ajax({
			type: 'POST',
			url: '/openOrCloseGarage',
			data: { garageSwitch: 'close' },
			success: function(result) {
				$('#status').html(result);
			}
		});
	});

	$('#personOneAway').click(function(e) {
		e.preventDefault();
		// $('#personOneAway').attr('disabled', 'disabled');
		$.ajax({
			type: 'POST',
			url: '/togglePersonOneHomeAway',
			data: {},
			success: function(result) {
				// $('#status').html(result);
			}
		});
	});

	$('#personTwoAway').click(function(e) {
		e.preventDefault();
		// $('#personTwoAway').attr('disabled', 'disabled');
		$.ajax({
			type: 'POST',
			url: '/togglePersonTwoHomeAway',
			data: {},
			success: function(result) {
				// $('#status').html(result);
			}
		});
	});

	$('#video').click(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: '/video',
			success: function(result) {
				$('#status').html(result);
			}
		});
	});

	$('#gps').click(function(e) {
		e.preventDefault();
		$('#gps').attr('disabled', 'disabled');
		$.ajax({
			type: 'POST',
			url: '/gpsToggle',
			success: function(result) {
				$('#status').html(result);
			}
		});
	});

	$('#lights25').click(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: '/lights/25',
			success: function(result) {
				$('#status').html(result);
			}
		});
	});
	$('#lights50').click(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: '/lights/50',
			success: function(result) {
				$('#status').html(result);
			}
		});
	});
	$('#lights75').click(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: '/lights/75',
			success: function(result) {
				$('#status').html(result);
			}
		});
	});
	$('#lights100').click(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: '/lights/100',
			success: function(result) {
				$('#status').html(result);
			}
		});
	});
});
