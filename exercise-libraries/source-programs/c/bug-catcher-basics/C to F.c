/*
 * @codescope
 * @title Celsius to Fahrenheit
 * @bug id=bug-1 line=1 token=2 correct="include" wrong="Include" choices="Include|import"
 * @bug id=bug-2 line=1 token=4 correct="stdio" wrong="studio" choices="studio|std"
 * @bug id=bug-3 line=7 token=6 correct="celsius" wrong="Celsius" choices="Celsius|celcius"
 * @bug id=bug-4 line=8 token=4 correct="celsius" wrong="Celsius" choices="Celsius|celcius"
 * @bug id=bug-5 line=10 token=1 correct="return" wrong="Return" choices="Return|retun"
 */
#include <stdio.h>

int main()
{
    float celsius, fahr;
    printf("Enter Celsius: ");
    scanf("%f", &celsius);
    fahr = (celsius * 9 / 5) + 32;
    printf("Fahrenheit: %.1f\n", fahr);
    return 0;
}
