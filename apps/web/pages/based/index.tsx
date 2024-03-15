import {
  AverageEventDurationChart,
  BookingKPICards,
  BookingStatusLineChart,
  LeastBookedTeamMembersTable,
  MostBookedTeamMembersTable,
  PopularEventsTable,
} from "@calcom/features/insights/components";
import { FiltersProvider } from "@calcom/features/insights/context/FiltersProvider";
import { Filters } from "@calcom/features/insights/filters";
import Shell from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";

import useMeQuery from "@lib/hooks/useMeQuery";

import PageWrapper from "@components/PageWrapper";

import { BookingsList } from "~/bookings/views/bookings-listing-view";

export default function BasedPage() {
  const { t } = useLocale();
  const utils = trpc.useContext();

  const user = useMeQuery().data;

  return (
    <div>
      <Shell
        heading="Based"
        title="Based"
        description="Use Based to do this thing easy to use."
        hideHeadingOnMobile
        withoutMain={false}
        subtitle="Use Based to do this thing easy to use.">
        <BookingsList />
        {!user ? (
          <></>
        ) : (
          <FiltersProvider>
            <Filters />

            <div className="mb-4 space-y-4">
              <BookingKPICards />

              <BookingStatusLineChart />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PopularEventsTable />

                <AverageEventDurationChart />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MostBookedTeamMembersTable />
                <LeastBookedTeamMembersTable />
              </div>
              <small className="text-default block text-center">
                {t("looking_for_more_insights")}{" "}
                <a
                  className="text-blue-500 hover:underline"
                  href="mailto:updates@cal.com?subject=Feature%20Request%3A%20More%20Analytics&body=Hey%20Cal.com%20Team%2C%20I%20love%20the%20analytics%20page%20but%20I%20am%20looking%20for%20...">
                  {" "}
                  {t("contact_support")}
                </a>
              </small>
            </div>
          </FiltersProvider>
        )}
      </Shell>
    </div>
  );
}

BasedPage.PageWrapper = PageWrapper;
