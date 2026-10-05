/*
@codescope
@title Exam Average with Section Code
@result average
@input target=prelim value=82.5 min=0 max=100 step=0.5 decimals=2
@input target=midterm value=90 min=0 max=100 step=0.5 decimals=2
@input target=final value=88 min=0 max=100 step=0.5 decimals=2
@input target=section value='C' choices='A'|'B'|'C'
*/
#include <stdio.h>

int main() {
    float prelim;
    float midterm;
    float final;
    char section;
    float average;

    printf("Enter prelim, midterm and final scores: ");
    scanf("%f %f %f", &prelim, &midterm, &final);
    printf("Enter your section letter: ");
    scanf(" %c", &section);
    average = (prelim + midterm + final) / 3.0;
    printf("Section: %c\n", section);
    printf("Average: %.2f\n", average);
    return 0;
}
