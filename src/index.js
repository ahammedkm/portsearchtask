import $ from 'jquery';
import 'jquery-validation';
require('../node_modules/daterangepicker/daterangepicker.js');
require('../node_modules/daterangepicker/moment.min.js');
require('../node_modules/awesomplete/awesomplete.min.js');
import * as d3 from "d3";


var from,
    to,
    fromDate,
    toDate,
    svg,
    data,
    bisectDate,
    x,
    y,
    focus,
    height,
    width;

const searchForm = $('.search-form');
searchForm.validate({
    rules: {
        from: {
            required: true
        },
        to: {
            required: true
        },
        dates: {
            required: true

        }
    },
    messages:{
        from :'Please enter origin',
        to : 'Please enter destination',
        dates : 'Please select a date range'

    }
});

searchForm.on('submit', () => {
    if (searchForm.valid()) {

        const date = searchForm.find('input[name="dates"]').val();
        searchRates(from, to, fromDate, toDate);
    }
});


Awesomplete.$$(".search-form input.autocomplete").forEach(function(input) {
    const awesomplete = new Awesomplete(input);
    input.addEventListener('keyup', (e) => {
        var code = (e.keyCode || e.which);
        if (code === 37 || code === 38 || code === 39 || code === 40 || code === 27 || code === 13) {
            return;
        } else {
            const murl = '/api/ports/search/' + input.value;
            fetch(murl).then(r => r.json()).then(d => {
                awesomplete.list = (d.results) ? (d.results).map(function(i) {
                    return {
                        label: i.name,
                        value: i.id
                    }
                }) : [];
                awesomplete.replace = function(text) {
                    this.input.value = text;
                }

            });
        }
    });
    input.addEventListener("awesomplete-select", function(event) {
        console.log(event.text.label, event.text.value, event);
        if (event.target.id == "from")
            from = event.text.value;
        else
            to = event.text.value;
    });
});



$(function() {

    $('#date_range').daterangepicker({
            autoUpdateInput: false
        },
        function(start, end, label) {
            fromDate = start.format('YYYY-MM-DD');
            toDate = end.format('YYYY-MM-DD');
            console.log("A new date selection was made: " + start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD'));
        }

    );
    $('#date_range').on('apply.daterangepicker', function(ev, picker) {
        $(this).val(picker.startDate.format('DD/MM/YY') + ' - ' + picker.endDate.format('DD/MM/YY'));
    });

    $('#date_range').on('cancel.daterangepicker', function(ev, picker) {
        $(this).val('');
    });
});


function dateClicked(flights, date) {
    const element = $('#search-results .flights-list');
    element.fadeOut(200, () => {
        element.remove();
        const newElement = flightsList(flights[date]);
        newElement.css({
            display: 'none'
        });
        newElement.insertBefore('#search-results .dates-list');
        newElement.fadeIn(200);
    });
}

function setFormLoadingState(loading) {
    const fn = loading ? 'addClass' : 'removeClass';
    searchForm.find('.overlay')[fn]('visible');
    searchForm.find('.button')[fn]('is-loading');
}

function searchRates(from, to, fromDate, toDate) {
    setFormLoadingState(true);

    fetch('/api/rates/' + from + '/' + to + '/' + fromDate + '/' + toDate).then((r => r.json())).then(d => {
        setFormLoadingState(false);
        console.log(d.rates);
        data = (d.rates) ? (d.rates).map(function(i) {
            return {
                date: i[0],
                value: +i[1]
            }
        }) : [];

        if (data.length)
            drawLineChart(data);
        else {
            clear();
            let errMsg = 'There is no rates available. Please try again later.';
            $('#search-errors').html(`<h2 class="title is-4">${errMsg}</h2>`);
        }

    }).catch((err) => {
        setFormLoadingState(false);
        let errMsg = '';
        if (err.status === 404) {
            errMsg = 'No flights found';
        } else if (err.status === 400 && err.details) {
            errMsg = err.details.message;
        } else {
            errMsg = 'There is something wrong with our servers. Please try again later.';
        }
        clear();
        $('#search-errors').html(`<h2 class="title is-4">${errMsg}</h2>`);
    });
}
function clear(){
    d3.selectAll("svg > *").remove();
    $('#search-errors').html('');
}

function drawLineChart(data) {

    clear();

    // set the dimensions and margins of the graph
    var margin = {
            top: 20,
            right: 20,
            bottom: 30,
            left: 50
        },
        width = 960 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    // parse the date / time
    var parseTime = d3.timeParse("%Y-%m-%d");
    bisectDate = d3.bisector(function(d) {
        return d.date;
    }).left;

    // set the ranges
    x = d3.scaleTime().range([0, width]);
    y = d3.scaleLinear().range([height, 0]);

    // define the line
    var valueline = d3.line()
        .x(function(d) {
            return x(d.date);
        })
        .y(function(d) {
            return y(d.value);
        });

    
    var svg = d3.select("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    


    // format the data
    data.forEach(function(d) {
        d.date = parseTime(d.date);
        d.value = +d.value;
    });

    // Scale the range of the data
    x.domain(d3.extent(data, function(d) {
        return d.date;
    }));
    y.domain([0, d3.max(data, function(d) {
        return d.value;
    })]);

    // Add the valueline path.
    svg.append("path")
        .data([data])
        .attr("class", "line")
        .attr("d", valueline);

    // Add the X Axis
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    // Add the Y Axis
    svg.append("g")
        .call(d3.axisLeft(y));

    focus = svg.append("g") 
        .style("display", "none");

    // append the circle at the intersection               
    focus.append("circle") 
        .attr("class", "y") 
        .style("fill", "none") 
        .style("stroke", "blue") 
        .attr("r", 4); 

    // append the rectangle to capture mouse               
    svg.append("rect") 
        .attr("width", width) 
        .attr("height", height) 
        .style("fill", "none") 
        .style("pointer-events", "all") 
        .on("mouseover", function() {
            focus.style("display", null);
        })
        .on("mouseout", function() {
            focus.style("display", "none");
        })
        .on("mousemove", mousemove);


    // append the x line
    focus.append("line")
        .attr("class", "x")
        .style("stroke", "blue")
        .style("stroke-dasharray", "3,3")
        .style("opacity", 0.5)
        .attr("y1", 0)
        .attr("y2", height);

    // append the y line
    focus.append("line")
        .attr("class", "y")
        .style("stroke", "blue")
        .style("stroke-dasharray", "3,3")
        .style("opacity", 0.5)
        .attr("x1", width)
        .attr("x2", width);

    // append the circle at the intersection
    focus.append("circle")
        .attr("class", "y")
        .style("fill", "none")
        .style("stroke", "blue")
        .attr("r", 4);

    // place the value at the intersection
    focus.append("text")
        .attr("class", "y1")
        .style("stroke", "white")
        .style("stroke-width", "3.5px")
        .style("opacity", 0.8)
        .attr("dx", 8)
        .attr("dy", "-.3em");
    focus.append("text")
        .attr("class", "y2")
        .attr("dx", 8)
        .attr("dy", "-.3em");

    // place the date at the intersection
    focus.append("text")
        .attr("class", "y3")
        .style("stroke", "white")
        .style("stroke-width", "3.5px")
        .style("opacity", 0.8)
        .attr("dx", 8)
        .attr("dy", "1em");
    focus.append("text")
        .attr("class", "y4")
        .attr("dx", 8)
        .attr("dy", "1em");




}

function mousemove() { 
    var x0 = x.invert(d3.mouse(this)[0]), 
        i = bisectDate(data, x0, 1), 
        d0 = data[i - 1], 
        d1 = data[i], 
        d = x0 - d0.date > d1.date - x0 ? d1 : d0; 

    var formatDate = d3.timeFormat("%d-%b");


    focus.select("circle.y")
        .attr("transform",
            "translate(" + x(d.date) + "," +
            y(d.value) + ")");

    focus.select("text.y1")
        .attr("transform",
            "translate(" + x(d.date) + "," +
            y(d.value) + ")")
        .text(d.value);

    focus.select("text.y2")
        .attr("transform",
            "translate(" + x(d.date) + "," +
            y(d.value) + ")")
        .text(d.value);

    focus.select("text.y3")
        .attr("transform",
            "translate(" + x(d.date) + "," +
            y(d.value) + ")")
        .text(formatDate(d.date));

    focus.select("text.y4")
        .attr("transform",
            "translate(" + x(d.date) + "," +
            y(d.value) + ")")
        .text(formatDate(d.date));



}