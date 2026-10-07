/*
@codescope
@title Hours, Minutes, Seconds to Total Seconds
@result totalSeconds
@input target=hours value=1 min=0 max=23 step=1
@input target=minutes value=25 min=0 max=59 step=1
@input target=seconds value=30 min=0 max=59 step=1
*/
import java.util.Scanner;

public class B06_TimeToSeconds {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int hours;
        int minutes;
        int seconds;
        int totalSeconds;

        System.out.print("Enter hours minutes seconds: ");
        hours = input.nextInt();
        minutes = input.nextInt();
        seconds = input.nextInt();
        totalSeconds = hours * 3600 + minutes * 60 + seconds;
        System.out.println("Total seconds: " + totalSeconds);
    }
}
