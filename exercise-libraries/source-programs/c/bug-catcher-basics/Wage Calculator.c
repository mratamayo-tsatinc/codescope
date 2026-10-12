/*
 * @codescope
 * @title Wage Calculator
 * @bug id=bug-1 line=3 token=2 correct="main" wrong="man" choices="man|Main"
 * @bug id=bug-2 line=4 token=1 correct="{" wrong="}" choices="}|)"
 * @bug id=bug-3 line=5 token=4 correct="40" wrong="\"40\"" choices="\"40\"|40.0"
 * @bug id=bug-4 line=6 token=4 correct="15.50" wrong="\"15.50\"" choices="\"15.50\"|15,50"
 * @bug id=bug-5 line=8 token=2 correct="=" wrong="==" choices="==|+="
 * @bug id=bug-6 line=11 token=1 correct="}" wrong="{" choices="{|)"
 */
#include <stdio.h>

int main()
{
    int hours = 40;
    float rate = 15.50;
    float total;
    total = hours * rate;
    printf("Pay: $%.2f", total);
    return 0;
}
