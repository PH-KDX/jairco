import { HandlerResult } from "@/types";
import { ButtonComponent } from "@/structures";
import {
    ButtonInteraction,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} from "discord.js";
import CringeViewUserSelectPageStartButtonComponent from "@/button/fun/CringeViewUserSelectPageStart";
import CringeViewUserNextPageButtonComponent from "@/button/fun/CringeViewUserNextPage";

export default class CringeViewUserPreviousPageButtonComponent extends ButtonComponent {
    public static readonly builder = new ButtonBuilder()
        .setCustomId("cringeViewUserPreviousPage")
        .setStyle(ButtonStyle.Success)
        .setLabel("<");

    constructor() {
        super({
            builder: CringeViewUserPreviousPageButtonComponent.builder
        });
    }

    public async run(i: ButtonInteraction): Promise<HandlerResult> {
        const context = await this.client.redis.getMessageContext(
            "cringeViewUser",
            i.message.id
        );
        if (!context) {
            this.client.sender.reply(
                i,
                { ephemeral: true, components: [] },
                {
                    langLocation: "misc.actionExpired",
                    msgType: "INVALID",
                    method: "UPDATE"
                }
            );
            return { result: "ACTION_EXPIRED" };
        }
        if (i.user.id !== context.pageMenuOwnerId) {
            this.client.sender.reply(
                i,
                { ephemeral: true },
                { langLocation: "misc.missingPermissions", msgType: "INVALID" }
            );
            return { result: "USER_MISSING_PERMISSIONS" };
        }

        const user = await this.client.users.fetch(context.userId);
        const cringeCount =
            context.type === "received"
                ? await this.client.prisma.cringes.count({
                      where: { ReceivedByUser: { discordId: user.id } }
                  })
                : await this.client.prisma.cringes.count({
                      where: { GivenByUser: { discordId: user.id } }
                  });
        if (cringeCount === 0) {
            this.client.redis.delMessageContext(
                "cringeLeaderboard",
                i.message.id
            );
            this.client.sender.reply(
                i,
                { ephemeral: true, components: [] },
                {
                    langLocation: "misc.pageMenuUnavailable",
                    msgType: "INVALID",
                    method: "UPDATE"
                }
            );
            return { result: "OTHER", note: "Menu no longer has any entries" };
        }

        const maxPage = Math.ceil(cringeCount / 10);
        const newPage = context.page > 1 ? context.page - 1 : maxPage;
        const embed = await this.client.utils.getViewUserCringesPage(
            i,
            user,
            context.type,
            cringeCount,
            newPage
        );
        const buttons = new ActionRowBuilder<ButtonBuilder>().setComponents(
            CringeViewUserPreviousPageButtonComponent.builder,
            new ButtonBuilder(
                CringeViewUserSelectPageStartButtonComponent.builder.data
            ).setLabel(`${newPage}/${maxPage}`),
            CringeViewUserNextPageButtonComponent.builder
        );

        this.client.sender.reply(
            i,
            { embeds: [embed], components: [buttons] },
            { method: "UPDATE" }
        );
        if (cringeCount > 10) {
            this.client.redis.setMessageContext(
                "cringeViewUser",
                i.message.id,
                {
                    ...context,
                    page: newPage
                }
            );
        } else {
            this.client.redis.delMessageContext("cringeViewUser", i.message.id);
        }

        return { result: "SUCCESS" };
    }
}
