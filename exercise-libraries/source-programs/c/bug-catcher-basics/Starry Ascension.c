/*
 * @codescope
 * @title Starry Ascension
 * @bug id=bug-1 line=3 token=2 correct="main" wrong="Main" choices="Main|man"
 * @bug id=bug-2 line=4 token=1 correct="{" wrong="}" choices="}|)"
 * @bug id=bug-3 line=6 token=5 correct=";" wrong=":" choices=":|,"
 * @bug id=bug-4 line=9 token=1 correct="printf" wrong="Printf" choices="Printf|print"
 * @bug id=bug-5 line=10 token=1 correct="return" wrong="Return" choices="Return|retun"
 */
#include <stdio.h>

int main()
{
    printf("*\n");
    printf("**\n");
    printf("***\n");
    printf("****\n");
    printf("*****\n");
    return 0;
}
