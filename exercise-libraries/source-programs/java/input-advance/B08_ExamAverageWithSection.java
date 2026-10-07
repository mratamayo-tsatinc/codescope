/*
@codescope
@title Exam Average with Section Code
@result average
@input target=prelim value=82.5 min=0 max=100 step=0.5 decimals=2
@input target=midterm value=90 min=0 max=100 step=0.5 decimals=2
@input target=finalScore value=88 min=0 max=100 step=0.5 decimals=2
@input target=section value='C' choices='A'|'B'|'C'
*/
import java.util.Scanner;

public class B08_ExamAverageWithSection {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        double prelim;
        double midterm;
        double finalScore;
        char section;
        double average;

        System.out.print("Enter prelim, midterm and final scores: ");
        prelim = input.nextDouble();
        midterm = input.nextDouble();
        finalScore = input.nextDouble();
        System.out.print("Enter your section letter: ");
        section = input.next().charAt(0);
        average = (prelim + midterm + finalScore) / 3.0;
        System.out.println("Section: " + section);
        System.out.println("Average: " + average);
    }
}
